import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { can } from "@/core/autorizacion";
import { hoyManagua, sumarDias } from "@/modules/cotizaciones/fechas";
import type { ContadoresMenu } from "@/modules/navegacion/contadores";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearCotizacionPanel, crearEtapaPanel, crearMaterialPanel, crearOrdenPanel, prepararPanel, type EntornoPanel } from "./panel-ayudas";

let db: PrismaClient;
let entorno: EntornoPanel;
let ruta: typeof import("@/app/api/v1/contadores/route");
const hoy = hoyManagua();
const fecha = (dias: number) => sumarDias(hoy, dias).toISOString().slice(0, 10);

async function consultar(perfil: keyof EntornoPanel["sesiones"]): Promise<ContadoresMenu> {
  const respuesta = await ruta.GET(peticion("GET", "/api/v1/contadores", { cookie: entorno.sesiones[perfil].cookie }));
  expect(respuesta.status).toBe(200);
  return (await respuesta.json()).datos;
}

async function probarCotizaciones() {
  const anterior = await consultar("ATENCION_CLIENTE");
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", emision: fecha(-5), vencimiento: fecha(0) });
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", emision: fecha(-1), vencimiento: fecha(3) });
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", emision: fecha(-1), vencimiento: fecha(4) });
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", emision: fecha(-5), vencimiento: fecha(1), archivada: true });
  await crearCotizacionPanel(entorno, { estado: "AJUSTE_SOLICITADO" });
  const ajuste = await crearCotizacionPanel(entorno, { estado: "AJUSTE_SOLICITADO" });
  await crearCotizacionPanel(entorno, { origenId: ajuste.id, version: 2 });
  const actual = await consultar("ATENCION_CLIENTE");
  expect(actual["/cotizaciones"]).toEqual({ total: (anterior["/cotizaciones"]?.total ?? 0) + 4, tono: "neutro" });
}

async function probarOrdenes() {
  const anterior = await consultar("OPERACIONES");
  await crearOrdenPanel(entorno, { fechaEntrega: fecha(-1), responsableId: null });
  await crearOrdenPanel(entorno, { fechaEntrega: fecha(1), responsableId: null });
  await crearOrdenPanel(entorno, { fechaEntrega: fecha(0) });
  await crearOrdenPanel(entorno, { fechaEntrega: fecha(-1), responsableId: null, estado: "CANCELADA" });
  const actual = await consultar("OPERACIONES");
  expect(actual["/ordenes"]).toEqual({ total: (anterior["/ordenes"]?.total ?? 0) + 3, tono: "peligro" });
}

async function probarMateriales() {
  const anterior = await consultar("ADMINISTRACION");
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "2" });
  await crearMaterialPanel(entorno, { existencia: "2", minimo: "2" });
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "0" });
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "2", activo: false });
  const actual = await consultar("ADMINISTRACION");
  expect(actual["/inventario"]).toEqual({ total: (anterior["/inventario"]?.total ?? 0) + 2, tono: "peligro" });
}

async function probarEtapas() {
  const anterior = await consultar("PRODUCCION");
  const orden = await crearOrdenPanel(entorno, { fechaEntrega: fecha(5) });
  const terminal = await crearOrdenPanel(entorno, { estado: "CANCELADA" });
  const area = await db.area.create({ data: { nombre: `Contadores ${orden.id}` } });
  const base = { ordenId: orden.id, areaId: area.id, nombre: "Etapa contadores",
    responsableId: entorno.sesiones.PRODUCCION.usuarioId, fechaFinPlan: sumarDias(hoy, -1) };
  await crearEtapaPanel(entorno, { ...base, secuencia: 1 });
  await crearEtapaPanel(entorno, { ...base, secuencia: 2, responsableId: entorno.sesiones.GERENCIA.usuarioId });
  await crearEtapaPanel(entorno, { ...base, secuencia: 3, fechaFinPlan: sumarDias(hoy, 0) });
  await crearEtapaPanel(entorno, { ...base, secuencia: 4, estado: "OMITIDA" });
  await crearEtapaPanel(entorno, { ...base, secuencia: 1, ordenId: terminal.id });
  const actual = await consultar("PRODUCCION");
  expect(actual["/produccion"]).toEqual({ total: (anterior["/produccion"]?.total ?? 0) + 1, tono: "peligro" });
}

function pruebasPorPerfil() {
  const claves = {
    GERENCIA: ["/cotizaciones", "/ordenes", "/inventario", "/produccion"],
    ADMINISTRACION: ["/cotizaciones", "/ordenes", "/inventario"],
    OPERACIONES: ["/cotizaciones", "/ordenes", "/inventario"],
    ATENCION_CLIENTE: ["/cotizaciones", "/ordenes"],
    PRODUCCION: ["/ordenes", "/produccion"],
  };
  for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION"] as const) {
    it(`${perfil}: limita las claves mediante permisos`, async () => {
      const contadores = await consultar(perfil);
      expect(Object.keys(contadores)).toEqual(claves[perfil]);
      const actor = entorno.sesiones[perfil].actor;
      for (const [clave, permiso] of [["/cotizaciones", "cotizacion:ver"], ["/ordenes", "orden:ver"],
        ["/inventario", "inventario:ver"], ["/produccion", "produccion:ver"]] as const) {
        if (!can(actor, permiso)) expect(contadores).not.toHaveProperty(clave);
      }
      for (const contador of Object.values(contadores)) expect(contador.total).toBeGreaterThan(0);
      if (perfil === "PRODUCCION") expect(contadores["/produccion"]?.total).toBe(1);
      if (perfil === "GERENCIA") expect(contadores["/produccion"]?.total).toBe(1);
      if (perfil === "ATENCION_CLIENTE") expect(contadores).toHaveProperty("/cotizaciones");
    });
  }
}

function pruebasIntegracion() {
  beforeAll(async () => {
    db = crearClientePropietario();
    entorno = await prepararPanel(db);
    ruta = await import("@/app/api/v1/contadores/route");
  });
  afterAll(async () => { await liberarClienteGlobal(); await db?.$disconnect(); });
  it("suma alertas comerciales y excluye archivos y ajustes corregidos", probarCotizaciones);
  it("suma órdenes activas atrasadas y sin responsable", probarOrdenes);
  it("cuenta materiales activos incluyendo igualdad al mínimo", probarMateriales);
  it("cuenta únicamente etapas propias atrasadas de órdenes activas", probarEtapas);
  pruebasPorPerfil();
  it("rechaza ADMIN sin panel:ver", async () => {
    const respuesta = await ruta.GET(peticion("GET", "/api/v1/contadores", { cookie: entorno.sesiones.ADMIN.cookie }));
    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).error.codigo).toBe("SIN_PERMISO");
  });
  it("rechaza solicitudes sin sesión", async () => {
    const respuesta = await ruta.GET(peticion("GET", "/api/v1/contadores"));
    expect(respuesta.status).toBe(401);
  });
}

describeConBase("GET /api/v1/contadores", pruebasIntegracion);
