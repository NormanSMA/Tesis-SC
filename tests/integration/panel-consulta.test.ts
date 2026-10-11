import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PanelDto } from "@/modules/panel/tipos";
import { formatear, leerDecimal, restar } from "@/core/decimal";
import { consultarMaterialesPanel } from "@/modules/panel/repo";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion } from "./cotizaciones-ayudas";
import { invocar } from "./ordenes-ayudas";
import { clavesMonetarias, completarEtapaPanel, crearCotizacionPanel, crearEtapaPanel, crearMaterialPanel, crearOrdenPanel, prepararPanel, valorIndicador, type EntornoPanel } from "./panel-ayudas";

let db: PrismaClient;
let entorno: EntornoPanel;
const instante = new Date("2034-05-10T12:00:00Z");
const PANELES = {
  GERENCIA: ["monto-aprobado", "tasa-aprobacion", "en-produccion", "ordenes-atrasadas"],
  OPERACIONES: ["por-iniciar", "sin-responsable", "en-produccion", "entregas-proximas"],
  ATENCION_CLIENTE: ["enviadas", "por-vencer", "aprobadas-mes", "clientes-nuevos"],
  PRODUCCION: ["mis-etapas-en-curso", "mis-etapas-pendientes", "completadas-hoy", "mis-etapas-atrasadas"],
  ADMINISTRACION: ["materiales-bajo-minimo", "consumos-hoy", "valor-inventario", "movimientos-semana"],
} as const;

async function vigenciaYMedianoche() {
  const actor = entorno.sesiones.ATENCION_CLIENTE.actor;
  const anterior = await entorno.servicio.obtenerPanel(actor, instante);
  for (const vencimiento of ["2034-05-09", "2034-05-10", "2034-05-13", "2034-05-14"]) {
    await crearCotizacionPanel(entorno, { estado: "ENVIADA", vencimiento });
  }
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", vencimiento: "2034-05-10", archivada: true });
  const actual = await entorno.servicio.obtenerPanel(actor, instante);
  expect(valorIndicador(actual, "enviadas")).toBe(valorIndicador(anterior, "enviadas") + 3);
  expect(valorIndicador(actual, "por-vencer")).toBe(valorIndicador(anterior, "por-vencer") + 2);
  await crearCotizacionPanel(entorno, { estado: "ENVIADA", vencimiento: "2035-01-01" });
  const antes = await entorno.servicio.obtenerPanel(actor, new Date("2035-01-02T05:59:59.999Z"));
  const despues = await entorno.servicio.obtenerPanel(actor, new Date("2035-01-02T06:00:00Z"));
  expect(valorIndicador(despues, "enviadas")).toBe(valorIndicador(antes, "enviadas") - 1);
}
async function accionSinDuplicados() {
  const actor = entorno.sesiones.OPERACIONES.actor;
  const anterior = await entorno.servicio.obtenerPanel(actor, instante);
  const orden = await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-01", responsableId: null });
  await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-09", estado: "CANCELADA", responsableId: null });
  await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-10" });
  await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-17" });
  await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-18" });
  const actual = await entorno.servicio.obtenerPanel(actor, instante);
  expect(valorIndicador(actual, "sin-responsable")).toBe(valorIndicador(anterior, "sin-responsable") + 1);
  expect(valorIndicador(actual, "entregas-proximas")).toBe(valorIndicador(anterior, "entregas-proximas") + 2);
  expect(actual.atencionTotal).toBe(anterior.atencionTotal + 1);
  // La lista muestra como máximo 5 filas: con la base compartida de la suite la orden nueva puede quedar fuera.
  expect(actual.atencion.length).toBeLessThanOrEqual(5);
  expect(actual.atencion.filter((fila) => fila.id === orden.id).length).toBeLessThanOrEqual(1);
  if (anterior.atencionTotal < 5) expect(actual.atencion.map((fila) => fila.id)).toContain(orden.id);
  expect(actual.grafico?.datos).toHaveLength(6);
}
async function produccionPropia() {
  const actor = entorno.sesiones.PRODUCCION.actor;
  const anterior = await entorno.servicio.obtenerPanel(actor, instante);
  const orden = await crearOrdenPanel(entorno);
  const terminal = await crearOrdenPanel(entorno, { estado: "CANCELADA" });
  const area = await db.area.create({ data: { nombre: `Panel propio ${orden.id}` } });
  const propia = await crearEtapaPanel(entorno, { ordenId: orden.id, areaId: area.id, nombre: "Etapa propia", secuencia: 1,
    responsableId: actor.id, fechaFinPlan: new Date("2034-05-09") });
  const ajena = await crearEtapaPanel(entorno, { ordenId: orden.id, areaId: area.id, nombre: "Etapa ajena", secuencia: 2,
    responsableId: entorno.sesiones.GERENCIA.usuarioId, fechaFinPlan: new Date("2034-05-09") });
  await crearEtapaPanel(entorno, { ordenId: terminal.id, areaId: area.id, nombre: "Terminal", secuencia: 1, responsableId: actor.id });
  const actual = await entorno.servicio.obtenerPanel(actor, instante);
  expect(valorIndicador(actual, "mis-etapas-pendientes")).toBe(valorIndicador(anterior, "mis-etapas-pendientes") + 1);
  expect(valorIndicador(actual, "mis-etapas-atrasadas")).toBe(valorIndicador(anterior, "mis-etapas-atrasadas") + 1);
  expect(actual.atencion.map((fila) => fila.id)).toContain(propia.id);
  expect(actual.atencion.map((fila) => fila.id)).not.toContain(ajena.id);
  expect(JSON.stringify(actual)).not.toContain("Etapa ajena");
  expect(clavesMonetarias(actual)).toEqual([]);
  expect(actual.grafico?.datos).toHaveLength(7);
}
async function mesesConocidos() {
  const actor = entorno.sesiones.GERENCIA.actor;
  const fecha = new Date("2048-10-10T12:00:00Z");
  await crearCotizacionPanel(entorno, { estado: "APROBADA", total: "164700", respuesta: "2048-09-10T12:00:00Z" });
  await crearCotizacionPanel(entorno, { estado: "APROBADA", total: "184500", respuesta: "2048-10-01T06:00:00Z" });
  await crearCotizacionPanel(entorno, { estado: "RECHAZADA", respuesta: "2048-10-01T12:00:00Z" });
  await crearCotizacionPanel(entorno, { estado: "AJUSTE_SOLICITADO", respuesta: "2048-10-02T12:00:00Z" });
  await crearCotizacionPanel(entorno, { estado: "VENCIDA", vencimiento: "2048-10-03" });
  const actual = await entorno.servicio.obtenerPanel(actor, fecha);
  expect(actual.titulo).toBe("Octubre lleva C$ 184,500 aprobados, 12 % más que septiembre");
  expect(actual.indicadores.find((fila) => fila.id === "tasa-aprobacion")?.valor).toBe("25 %");
  expect(actual.grafico?.datos.at(-1)).toMatchObject({ valor: 184.5, destacado: true });
  const sinAnterior = await entorno.servicio.obtenerPanel(actor, new Date("2049-01-10T12:00:00Z"));
  expect(sinAnterior.titulo).toBe("Enero lleva C$ 0 aprobados, sin aprobaciones el mes anterior");
}
async function completadasPorActor() {
  const actor = entorno.sesiones.PRODUCCION.actor;
  const anterior = await entorno.servicio.obtenerPanel(actor, instante);
  const orden = await crearOrdenPanel(entorno);
  const area = await db.area.create({ data: { nombre: `Panel completadas ${orden.id}` } });
  const base = { ordenId: orden.id, areaId: area.id, responsableId: actor.id, usuarioId: actor.id };
  await completarEtapaPanel(entorno, { ...base, secuencia: 1, instante: "2034-05-10T06:00:00Z" });
  await completarEtapaPanel(entorno, { ...base, secuencia: 2, instante: "2034-05-10T05:59:59Z" });
  await completarEtapaPanel(entorno, { ...base, secuencia: 3, instante: "2034-05-04T06:00:00Z" });
  await completarEtapaPanel(entorno, { ...base, secuencia: 4, instante: "2034-05-04T05:59:59Z" });
  await completarEtapaPanel(entorno, { ...base, secuencia: 5, usuarioId: entorno.sesiones.ADMINISTRACION.usuarioId, instante: "2034-05-10T12:00:00Z" });
  const larga = await crearEtapaPanel(entorno, { ordenId: orden.id, areaId: area.id, responsableId: actor.id,
    nombre: "Etapa larga", secuencia: 6, estado: "EN_CURSO", fechaInicioReal: new Date("2034-05-08T11:59:59Z") });
  const actual = await entorno.servicio.obtenerPanel(actor, instante);
  expect(valorIndicador(actual, "completadas-hoy")).toBe(valorIndicador(anterior, "completadas-hoy") + 1);
  expect(actual.grafico!.datos.at(-1)!.valor).toBe(anterior.grafico!.datos.at(-1)!.valor + 1);
  expect(actual.grafico!.datos[0].valor).toBe(anterior.grafico!.datos[0].valor + 1);
  expect(actual.atencion.map((fila) => fila.id)).toContain(larga.id);
  expect(actual.atencion.find((fila) => fila.id === larga.id)?.detalle).toBe("En curso desde hace más de dos días");
}
async function ajustesYCreacion() {
  const actor = entorno.sesiones.ATENCION_CLIENTE.actor;
  const anterior = await entorno.servicio.obtenerPanel(actor, instante);
  const ajuste = await crearCotizacionPanel(entorno, { estado: "AJUSTE_SOLICITADO", respuesta: "2034-05-01T12:00:00Z" });
  const sinCorregir = await entorno.servicio.obtenerPanel(actor, instante);
  expect(sinCorregir.atencionTotal).toBe(anterior.atencionTotal + 1);
  await crearCotizacionPanel(entorno, { origenId: ajuste.id, version: 2, creadoEn: "2034-04-11T06:00:00Z" });
  await crearCotizacionPanel(entorno, { creadoEn: "2034-04-11T05:59:59Z" });
  const actual = await entorno.servicio.obtenerPanel(actor, instante);
  expect(actual.atencionTotal).toBe(anterior.atencionTotal);
  expect(actual.atencion.map((fila) => fila.id)).not.toContain(ajuste.id);
  const cantidad = (panel: PanelDto) => panel.grafico!.datos.find((fila) => fila.etiqueta === "Borrador")!.valor;
  expect(cantidad(actual)).toBe(cantidad(anterior) + 1);
}
async function alertasYDinero() {
  const base = entorno.sesiones.ADMINISTRACION.actor;
  const anterior = await entorno.servicio.obtenerPanel(base, instante);
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "2" });
  await crearMaterialPanel(entorno, { existencia: "2", minimo: "2" });
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "0" });
  await crearMaterialPanel(entorno, { existencia: "0", minimo: "2", activo: false });
  const actual = await entorno.servicio.obtenerPanel(base, instante);
  expect(valorIndicador(actual, "materiales-bajo-minimo")).toBe(valorIndicador(anterior, "materiales-bajo-minimo") + 2);
  expect(actual.atencion).toHaveLength(Math.min(5, actual.atencionTotal));
  for (const perfil of ["GERENCIA", "ADMINISTRACION"] as const) {
    const actor = entorno.sesiones[perfil].actor;
    const oculto = await entorno.servicio.obtenerPanel({ ...actor, permisos: actor.permisos.filter((permiso) => permiso !== "cotizacion:ver") }, instante);
    expect(clavesMonetarias(oculto)).toEqual([]);
    expect(oculto.indicadores.map((fila) => fila.id)).not.toContain("valor-inventario");
    if (perfil === "GERENCIA") expect(oculto.grafico).toBeNull();
  }
}
async function materialesCriticos() {
  const actor = entorno.sesiones.ADMINISTRACION.actor;
  const anterior = await entorno.servicio.obtenerPanel(actor, instante);
  const nombre = `000 Crítico ${instante.toISOString()}`;
  const critico = await crearMaterialPanel(entorno, { nombre, existencia: "0", minimo: "3" });
  for (let indice = 0; indice < 6; indice++) {
    await crearMaterialPanel(entorno, { existencia: "1", minimo: "4", nombre: `Carga ${indice}` });
  }
  const actual = await entorno.servicio.obtenerPanel(actor, instante);
  expect(actual.atencionTotal).toBe(anterior.atencionTotal + 7);
  expect(actual.atencion).toHaveLength(5);
  expect(actual.atencion[0].id).toBe(critico.id);
  expect(actual.grafico?.datos).toHaveLength(6);
}
async function valorInventarioExacto() {
  const antes = await consultarMaterialesPanel(true);
  await crearMaterialPanel(entorno, { existencia: "3.000", costo: "0.1001", minimo: "0" });
  const despues = await consultarMaterialesPanel(true);
  expect(formatear(restar(leerDecimal(despues.valor)!, leerDecimal(antes.valor)!), 7)).toBe("0.3003000");
  expect((await consultarMaterialesPanel(false)).valor).toBe("0");
}
async function consumosPorSemana() {
  const actor = entorno.sesiones.ADMINISTRACION.actor;
  const anterior = await entorno.servicio.obtenerPanel(actor, instante);
  const material = await crearMaterialPanel(entorno, { existencia: "10", minimo: "0" });
  const orden = await crearOrdenPanel(entorno, { estado: "EN_PRODUCCION" });
  const inicio = new Date("2034-05-10T00:00:00Z");
  inicio.setUTCDate(inicio.getUTCDate() - (inicio.getUTCDay() + 6) % 7 - 35);
  const primerDia = inicio.toISOString().slice(0, 10);
  for (const fecha of ["2034-05-10T06:00:00Z", "2034-05-10T05:59:59Z", `${primerDia}T06:00:00Z`, `${primerDia}T05:59:59Z`]) {
    await db.$transaction(async (tx) => {
      const movimiento = await tx.movimientoInventario.create({ data: { materialId: material.id, tipo: "CONSUMO",
        cantidad: "-1", usuarioId: actor.id, creadoEn: new Date(fecha) } });
      await tx.consumoOrden.create({ data: { ordenId: orden.id, materialId: material.id, movimientoId: movimiento.id } });
    });
  }
  const actual = await entorno.servicio.obtenerPanel(actor, instante);
  expect(valorIndicador(actual, "consumos-hoy")).toBe(valorIndicador(anterior, "consumos-hoy") + 1);
  expect(actual.grafico!.datos[0].valor).toBe(anterior.grafico!.datos[0].valor + 1);
  expect(actual.grafico!.datos.at(-1)!.valor).toBe(anterior.grafico!.datos.at(-1)!.valor + 2);
}

function pruebasApiPorPerfil() {
  for (const perfil of ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN"] as const) {
    it(`${perfil}: recibe su panel o 403`, async () => {
      const respuesta = await invocar<PanelDto>(entorno.panel.GET, peticion("GET", "/api/v1/panel", { cookie: entorno.sesiones[perfil].cookie }));
      expect(respuesta.status).toBe(perfil === "ADMIN" ? 403 : 200);
      if (perfil === "ADMIN") { expect(respuesta.error?.codigo).toBe("SIN_PERMISO"); return; }
      expect(respuesta.datos?.perfil).toBe(perfil);
      expect(respuesta.datos?.indicadores.map((fila) => fila.id)).toEqual(PANELES[perfil]);
      expect(respuesta.datos?.atencion.length).toBeLessThanOrEqual(5);
      expect(respuesta.datos?.perfilesDisponibles).toEqual([{ codigo: perfil, nombre: expect.any(String) }]);
    });
  }
}

describeConBase("panel: consultas y perfiles v9", () => {
  db = crearClientePropietario();
  beforeAll(async () => { entorno = await prepararPanel(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  it("cuenta vigentes con límites inclusivos y medianoche de Managua", vigenciaYMedianoche);
  it("cuenta órdenes distintas y entregas incluyendo una orden sin responsable", accionSinDuplicados);
  it("limita producción a las etapas del actor", produccionPropia);
  it("calcula meses, dinero exacto y tasa sobre todas las respuestas", mesesConocidos);
  it("cuenta completadas por el actor y detecta etapas largas", completadasPorActor);
  it("omite ajustes corregidos y respeta treinta días por creación", ajustesYCreacion);
  it("ordena alertas, excluye inactivos y oculta dinero sin permiso", alertasYDinero);
  it("prioriza la proporción crítica y limita cinco filas con el total completo", materialesCriticos);
  it("suma existencia por costo promedio con decimal exacto", valorInventarioExacto);
  it("cuenta consumos y agrupa seis semanas con fechas de Managua", consumosPorSemana);
  pruebasApiPorPerfil();
  it("ignora un perfil solicitado sin asignación", async () => {
    const respuesta = await invocar<PanelDto>(entorno.panel.GET, peticion("GET", "/api/v1/panel?perfil=GERENCIA", { cookie: entorno.sesiones.PRODUCCION.cookie }));
    expect(respuesta.datos?.perfil).toBe("PRODUCCION");
  });
  it("permite seleccionar otro perfil asignado con panel", async () => {
    const sesion = await abrirSesion(db, entorno.ordenes.cotizaciones.modulos, "ATENCION_CLIENTE");
    const perfil = await db.perfil.findUniqueOrThrow({ where: { codigo: "OPERACIONES" } });
    await db.usuarioPerfil.create({ data: { usuarioId: sesion.usuarioId, perfilId: perfil.id } });
    const respuesta = await invocar<PanelDto>(entorno.panel.GET, peticion("GET", "/api/v1/panel?perfil=ATENCION_CLIENTE", { cookie: sesion.cookie }));
    expect(respuesta.datos?.perfil).toBe("ATENCION_CLIENTE");
    expect(respuesta.datos?.perfilesDisponibles.map((fila) => fila.codigo)).toEqual(["OPERACIONES", "ATENCION_CLIENTE"]);
  });
  it("rechaza solicitudes sin sesión", async () => {
    expect(await invocar(entorno.panel.GET, peticion("GET", "/api/v1/panel"))).toMatchObject({ status: 401, error: { codigo: "SIN_SESION" } });
  });
  it("no escribe bitácora al consultar", async () => {
    const antes = await db.bitacora.count();
    await entorno.servicio.obtenerPanel(entorno.sesiones.GERENCIA.actor);
    expect(await db.bitacora.count()).toBe(antes);
  });
});
