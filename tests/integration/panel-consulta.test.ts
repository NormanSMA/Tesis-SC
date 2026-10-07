import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PanelDto } from "@/modules/panel/service";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { invocar } from "./ordenes-ayudas";
import { clavesMonetarias, crearCotizacionPanel, crearMaterialPanel, crearOrdenPanel, prepararPanel, type EntornoPanel } from "./panel-ayudas";

let db: PrismaClient;
let entorno: EntornoPanel;
const instante = new Date("2034-05-10T12:00:00Z");

async function pendientesConVigencia() {
  const anterior = await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor, instante);
  for (const vencimiento of ["2034-05-09", "2034-05-10", "2034-05-13", "2034-05-14"]) {
    await crearCotizacionPanel(entorno, { estado: "ENVIADA", vencimiento, total: "123.45" });
  }
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", vencimiento: "2034-05-10", archivada: true });
  const actual = await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor, instante);
  expect(actual.cotizaciones?.cantidad).toBe(anterior.cotizaciones!.cantidad + 3);
  expect(actual.cotizaciones?.vencenPronto).toBe(anterior.cotizaciones!.vencenPronto + 2);
  expect(actual.cotizaciones?.porMarcarVencidas).toBe(anterior.cotizaciones!.porMarcarVencidas + 1);
  expect(actual.cotizaciones!.filas.length).toBeLessThanOrEqual(10);
  const fechas = actual.cotizaciones!.filas.map((fila) => fila.vencimiento);
  expect(fechas).toEqual([...fechas].sort());
  for (const fila of actual.cotizaciones!.filas) expect(fila.total).toMatch(/^\d+\.\d{2}$/);
}
async function alertasCriticas() {
  const anterior = await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor, instante);
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "2" });
  await crearMaterialPanel(entorno, { existencia: "2", minimo: "2" });
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "0" });
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "2", activo: false });
  const actual = await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor, instante);
  expect(actual.materiales?.enAlerta).toBe(anterior.materiales!.enAlerta + 2);
  expect(actual.materiales?.sinExistencia).toBe(anterior.materiales!.sinExistencia + 2);
  expect(actual.materiales!.filas.length).toBeLessThanOrEqual(10);
  expect(actual.materiales!.filas[0].existencia).toBe("0.000");
}
async function cargaYEntregas() {
  const anterior = await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor, instante);
  const orden = await crearOrdenPanel(entorno, { estado: "EN_PRODUCCION", fechaEntrega: "2034-05-09" });
  const terminal = await crearOrdenPanel(entorno, { estado: "CANCELADA", fechaEntrega: "2034-05-09" });
  const hoy = await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-10" });
  const limite = await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-17" });
  const fuera = await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-18" });
  const area = await db.area.create({ data: { nombre: `Área panel ${orden.id}` } });
  for (const ordenId of [orden.id, terminal.id]) await db.etapaOrden.create({ data: { ordenId, areaId: area.id,
    nombre: "Impresión panel", secuencia: 1, responsableId: entorno.sesiones.PRODUCCION.usuarioId, fechaFinPlan: new Date("2020-01-01") } });
  const actual = await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor, instante);
  expect(actual.resumen?.enProduccion).toBe(anterior.resumen!.enProduccion + 1);
  expect(actual.resumen?.atrasadas).toBe(anterior.resumen!.atrasadas + 1);
  expect(actual.resumen?.entregasProximas).toBe(anterior.resumen!.entregasProximas + 2);
  const grupo = actual.carga!.porArea.find((fila) => fila.nombre === area.nombre)!;
  expect(grupo).toMatchObject({ cantidad: 1, atrasadas: 1 });
  expect(grupo.etapas[0].href).toBe(`/ordenes/${orden.id}`);
  const enlaces = actual.carga!.entregas.map((fila) => fila.href);
  expect(enlaces).toContain(`/ordenes/${hoy.id}`); expect(enlaces).toContain(`/ordenes/${limite.id}`);
  expect(enlaces).not.toContain(`/ordenes/${fuera.id}`);
  expect(enlaces).not.toContain(`/ordenes/${terminal.id}`);
}
async function medianocheManagua() {
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", vencimiento: "2035-01-01" });
  const actor = entorno.sesiones.GERENCIA.actor;
  const antes = await entorno.servicio.obtenerPanel(actor, new Date("2035-01-02T05:59:59.999Z"));
  const despues = await entorno.servicio.obtenerPanel(actor, new Date("2035-01-02T06:00:00Z"));
  expect(antes.hoy).toBe("2035-01-01"); expect(despues.hoy).toBe("2035-01-02");
  expect(despues.cotizaciones!.porMarcarVencidas).toBe(antes.cotizaciones!.porMarcarVencidas + 1);
}
async function bloquesPorPermiso() {
  const base = entorno.sesiones.GERENCIA.actor;
  for (const permiso of ["cotizacion:ver", "inventario:ver", "orden:ver", "produccion:ver"]) {
    const actual = await entorno.servicio.obtenerPanel({ ...base, permisos: base.permisos.filter((valor) => valor !== permiso) });
    if (permiso === "cotizacion:ver") { expect(actual).not.toHaveProperty("cotizaciones"); expect(clavesMonetarias(actual)).toEqual([]); }
    if (permiso === "inventario:ver") expect(actual).not.toHaveProperty("materiales");
    if (permiso === "orden:ver" || permiso === "produccion:ver") { expect(actual).not.toHaveProperty("carga"); expect(actual).not.toHaveProperty("resumen"); }
  }
}
describeConBase("panel: consultas y perfiles", () => {
  db = crearClientePropietario();
  beforeAll(async () => { entorno = await prepararPanel(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  it("cuenta vigentes, próximas y vencidas con límites inclusivos", pendientesConVigencia);
  it("reutiliza alertas y ordena materiales críticos", alertasCriticas);
  it("cuenta carga, atrasos y siete días excluyendo terminales", cargaYEntregas);
  it("cambia vigencia en el borde de medianoche de Managua", medianocheManagua);
  it("omite bloques cuando falta el permiso de su dato", bloquesPorPermiso);
  for (const perfil of ["GERENCIA", "VENTAS", "PRODUCCION", "ADMIN"] as const) {
    it(`${perfil}: contrato de panel y ausencia de dinero`, async () => {
      const actual = await invocar<PanelDto>(entorno.panel.GET, peticion("GET", "/api/v1/panel", { cookie: entorno.sesiones[perfil].cookie }));
      expect(actual.status).toBe(perfil === "ADMIN" ? 403 : 200);
      if (perfil === "ADMIN") { expect(actual.error?.codigo).toBe("SIN_PERMISO"); return; }
      expect(actual.datos).toHaveProperty("materiales"); expect(actual.datos).toHaveProperty("resumen");
      if (perfil === "PRODUCCION") { expect(actual.datos).not.toHaveProperty("cotizaciones"); expect(clavesMonetarias(actual.cuerpo)).toEqual([]); }
      else expect(actual.datos).toHaveProperty("cotizaciones");
    });
  }
  it("rechaza solicitudes sin sesión con 401", async () => {
    expect(await invocar(entorno.panel.GET, peticion("GET", "/api/v1/panel"))).toMatchObject({ status: 401, error: { codigo: "SIN_SESION" } });
  });
  it("no escribe movimientos ni bitácora al consultar", async () => {
    const antes = await db.bitacora.count();
    await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor);
    expect(await db.bitacora.count()).toBe(antes);
  });
});
