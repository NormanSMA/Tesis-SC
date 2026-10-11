import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { esquemaConsulta } from "@/modules/reportes/schema";
import { tasaAprobacion } from "@/modules/reportes/reglas";
import { CERO, formatear, leerDecimal, sumar } from "@/core/decimal";
import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearCotizacionPanel, crearEtapaPanel, crearMaterialPanel, crearOrdenPanel, prepararPanel, type EntornoPanel } from "./panel-ayudas";
import { crearBorrador, itemUnidad, prepararCotizaciones } from "./cotizaciones-ayudas";

let db: PrismaClient;
let entorno: EntornoPanel;
const instante = new Date("2034-05-10T12:00:00Z");
function reporte(nombre: "cotizaciones-por-estado" | "existencias" | "carga-por-operario" | "ordenes-por-etapa", filtros: object = {}) {
  return entorno.reportes.obtenerReporte({ nombre, consulta: esquemaConsulta.parse(filtros), actor: entorno.sesiones.GERENCIA.actor, instante });
}
async function cotizacionesConTotales() {
  const filtros = { desde: "2040-01-01", hasta: "2040-01-01" };
  const anterior = await reporte("cotizaciones-por-estado", filtros);
  const estados = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA"] as const;
  for (const estado of estados) await crearCotizacionPanel(entorno, { estado, total: "10.01", creadoEn: "2040-01-01T12:00:00Z" });
  await crearCotizacionPanel(entorno, { estado: "APROBADA", total: "0.02", creadoEn: "2040-01-01T13:00:00Z" });
  const actual = await reporte("cotizaciones-por-estado", filtros);
  expect(actual.totales.cantidad).toBe(Number(anterior.totales.cantidad) + 6);
  expect(actual.totales.importe).toBe(formatear(sumar(leerDecimal(String(anterior.totales.importe))!, leerDecimal("50.07")!), 2));
  for (const [indice, fila] of actual.filas.entries()) {
    const incremento = indice === 5 ? 0 : indice === 2 ? 2 : 1;
    expect(fila.cantidad).toBe(Number(anterior.filas[indice].cantidad) + incremento);
  }
  expect(actual.totales.tasaAprobacion).toBe(tasaAprobacion(Number(actual.filas[2].cantidad), Number(actual.filas[3].cantidad)));
  expect(actual.generadoEn).toBe(instante.toISOString());
}
async function existenciasExactas() {
  const marca = `Valor exacto ${entorno.sesiones.GERENCIA.usuarioId}`;
  await crearMaterialPanel(entorno, { nombre: `${marca} A`, existencia: "1.111", minimo: "2", costo: "1.2345" });
  await crearMaterialPanel(entorno, { nombre: `${marca} B`, existencia: "2.001", minimo: "0", costo: "0.1001" });
  await crearMaterialPanel(entorno, { nombre: `${marca} C`, existencia: "0", minimo: "3", costo: "9.8765" });
  await crearMaterialPanel(entorno, { nombre: `${marca} Archivado`, activo: false });
  const actual = await reporte("existencias", { texto: marca });
  expect(actual.filas).toHaveLength(3);
  expect(actual.filas[0]).toMatchObject({ existencia: "1.111", stockMinimo: "2.000", costoPromedio: "1.2345", valorInventario: "1.37", alerta: "Stock bajo" });
  expect(actual.filas[1]).toMatchObject({ valorInventario: "0.20", alerta: "Sin alerta" });
  expect(actual.totales).toEqual({ materiales: 3, enAlerta: 2, sinExistencia: 1, valorInventario: "1.57" });
  const alertas = await reporte("existencias", { texto: marca, soloAlertas: "true" });
  expect(alertas.filas).toHaveLength(2); expect(alertas.totales.valorInventario).toBe("1.37");
}
async function valorSinRedondeoPrematuro() {
  const marca = `Redondeo ${entorno.sesiones.GERENCIA.usuarioId}`;
  for (const sufijo of ["A", "B"]) await crearMaterialPanel(entorno, { nombre: `${marca} ${sufijo}`, existencia: "1", costo: "0.0049" });
  const actual = await reporte("existencias", { texto: marca });
  expect(actual.filas.map((fila) => fila.valorInventario)).toEqual(["0.00", "0.00"]);
  expect(actual.totales.valorInventario).toBe("0.01");
}
async function cargaConPeriodo() {
  const orden = await crearOrdenPanel(entorno, { estado: "EN_PRODUCCION" });
  const terminal = await crearOrdenPanel(entorno, { estado: "CANCELADA" });
  const areaId = (await db.area.create({ data: { nombre: `Carga ${entorno.sesiones.GERENCIA.usuarioId}` } })).id;
  const base = { ordenId: orden.id, areaId, responsableId: entorno.sesiones.PRODUCCION.usuarioId };
  for (const etapa of [
    { ...base, secuencia: 1, nombre: "Pendiente", fechaFinPlan: new Date("2034-05-09") },
    { ...base, secuencia: 2, nombre: "En curso", estado: "EN_CURSO", fechaInicioReal: new Date("2034-05-01T12:00:00Z") },
    { ...base, secuencia: 3, nombre: "Completada al inicio", estado: "COMPLETADA", fechaInicioReal: new Date("2034-04-01T12:00:00Z"), fechaFinReal: new Date("2034-05-01T06:00:00Z") },
    { ...base, secuencia: 4, nombre: "Completada al final", estado: "COMPLETADA", fechaInicioReal: new Date("2034-04-01T12:00:00Z"), fechaFinReal: new Date("2034-05-02T05:59:59.999Z") },
    { ...base, secuencia: 5, nombre: "Completada fuera", estado: "COMPLETADA", fechaInicioReal: new Date("2034-04-01T12:00:00Z"), fechaFinReal: new Date("2034-05-02T06:00:00Z") },
    { ...base, ordenId: terminal.id, secuencia: 1, nombre: "Terminal pendiente", fechaFinPlan: new Date("2034-05-09") },
    { ...base, ordenId: terminal.id, secuencia: 2, nombre: "Terminal completada", estado: "COMPLETADA", fechaInicioReal: new Date("2034-04-01T12:00:00Z"), fechaFinReal: new Date("2034-05-01T12:00:00Z") },
  ] as const) await crearEtapaPanel(entorno, etapa);
  const actual = await reporte("carga-por-operario", { desde: "2034-05-01", hasta: "2034-05-01" });
  const fila = actual.filas.find((fila) => fila.responsableId === base.responsableId);
  expect(fila).toMatchObject({ pendientes: 1, enCurso: 1, completadas: 3, atrasadas: 1, ordenes: 1 });
  for (const campo of Object.keys(actual.totales)) expect(actual.totales[campo]).toBe(actual.filas.reduce((suma, fila) => suma + Number(fila[campo]), 0));
}
async function primeraEtapa() {
  const area = await db.area.create({ data: { nombre: `Etapa actual ${entorno.sesiones.GERENCIA.usuarioId}` } });
  const otra = await db.area.create({ data: { nombre: `Etapa posterior ${entorno.sesiones.GERENCIA.usuarioId}` } });
  for (const fechaEntrega of ["2034-05-09", "2034-05-10"]) {
    const orden = await crearOrdenPanel(entorno, { fechaEntrega });
    for (const etapa of [
      { ordenId: orden.id, areaId: otra.id, secuencia: 1, nombre: "Omitida", estado: "OMITIDA" },
      { ordenId: orden.id, areaId: area.id, secuencia: 2, nombre: "Impresión" },
      { ordenId: orden.id, areaId: otra.id, secuencia: 3, nombre: "Corte" },
    ] as const) await crearEtapaPanel(entorno, etapa);
  }
  const terminal = await crearOrdenPanel(entorno, { estado: "CANCELADA" });
  await db.etapaOrden.create({ data: { ordenId: terminal.id, areaId: area.id, secuencia: 1, nombre: "Impresión" } });
  const actual = await reporte("ordenes-por-etapa", { area: area.id });
  expect(actual.filas).toEqual([{ etapa: "Impresión", area: area.nombre, cantidad: 2, atrasadas: 1 }]);
  expect(actual.totales).toEqual({ cantidad: 2, atrasadas: 1 });
  expect((await reporte("ordenes-por-etapa", { area: otra.id })).filas).toEqual([]);
}
async function sinEtapaAbierta() {
  const anterior = await reporte("ordenes-por-etapa");
  await crearOrdenPanel(entorno, { fechaEntrega: "2034-05-09" });
  const actual = await reporte("ordenes-por-etapa");
  const filaAntes = anterior.filas.find((fila) => fila.etapa === "Sin etapa abierta");
  const fila = actual.filas.find((fila) => fila.etapa === "Sin etapa abierta");
  expect(fila?.cantidad).toBe(Number(filaAntes?.cantidad ?? 0) + 1);
  expect(fila?.atrasadas).toBe(Number(filaAntes?.atrasadas ?? 0) + 1);
}
async function bordesCotizaciones() {
  const filtros = { desde: "2040-02-01", hasta: "2040-02-01" };
  const anterior = await reporte("cotizaciones-por-estado", filtros);
  for (const creadoEn of ["2040-02-01T05:59:59.999Z", "2040-02-01T06:00:00Z", "2040-02-02T05:59:59.999Z", "2040-02-02T06:00:00Z"]) {
    await crearCotizacionPanel(entorno, { creadoEn, total: "0.10" });
  }
  const actual = await reporte("cotizaciones-por-estado", filtros);
  expect(actual.totales.cantidad).toBe(Number(anterior.totales.cantidad) + 2);
  expect(actual.totales.importe).toBe(formatear(sumar(leerDecimal(String(anterior.totales.importe))!, leerDecimal("0.20")!), 2));
}
async function ajustesSolicitados() {
  const cotizaciones = await prepararCotizaciones(db);
  const { servicio } = cotizaciones.modulos;
  const borrador = await crearBorrador(cotizaciones, { items: [itemUnidad(cotizaciones.referencias)] });
  // creado_en es inmutable: se fija con los triggers desactivados, igual que errores-bd.test.ts.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
    await tx.$executeRaw`UPDATE cotizacion SET creado_en = '2041-01-01T12:00:00Z'::timestamptz WHERE id = ${borrador.id}::uuid`;
  });
  const actualizada = await servicio.obtenerCotizacion(borrador.id);
  const enviada = await servicio.enviarCotizacion(borrador.id, actualizada.actualizadoEn, cotizaciones.ventas.actor);
  const filtros = { desde: "2041-01-01", hasta: "2041-01-01" };
  const anterior = await reporte("cotizaciones-por-estado", filtros);
  const solicitada = await servicio.responderCotizacion(enviada.id, {
    version: enviada.actualizadoEn, resultado: "AJUSTE_SOLICITADO", motivoAjuste: "Cambiar las medidas",
  }, cotizaciones.ventas.actor);
  const actual = await reporte("cotizaciones-por-estado", filtros);
  const antes = anterior.filas.find((fila) => fila.estado === "Ajustes solicitados")!;
  const despues = actual.filas.find((fila) => fila.estado === "Ajustes solicitados")!;
  expect(actual.filas).toHaveLength(6);
  expect(despues.cantidad).toBe(Number(antes.cantidad) + 1);
  expect(despues.importe).toBe(formatear(sumar(leerDecimal(String(antes.importe))!, leerDecimal(solicitada.total)!), 2));
  expect(actual.totales.cantidad).toBe(anterior.totales.cantidad);
  expect(actual.totales.importe).toBe(anterior.totales.importe);
}
async function sinDineroConReporte() {
  const actor = { ...entorno.sesiones.GERENCIA.actor, permisos: entorno.sesiones.GERENCIA.actor.permisos.filter((permiso) => permiso !== "cotizacion:ver") };
  const { clavesMonetarias } = await import("./panel-ayudas");
  for (const nombre of ["cotizaciones-por-estado", "existencias", "carga-por-operario", "ordenes-por-etapa"] as const) {
    const actual = await entorno.reportes.obtenerReporte({ nombre, consulta: esquemaConsulta.parse({}), actor });
    expect(clavesMonetarias(actual)).toEqual([]);
  }
}
async function consultaUnicaInventario() {
  const { prisma } = await import("@/lib/db");
  const consulta = vi.spyOn(prisma, "$queryRaw");
  try { await reporte("existencias", { texto: "inexistente" }); expect(consulta).toHaveBeenCalledTimes(1); }
  finally { consulta.mockRestore(); }
}

describeConBase("reportes: consultas contra PostgreSQL", () => {
  db = crearClientePropietario();
  beforeAll(async () => { entorno = await prepararPanel(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  it("agrupa todos los estados, importes y tasa conocida", cotizacionesConTotales);
  it("calcula inventario exacto y filtra alertas y archivados", existenciasExactas);
  it("suma productos antes del redondeo monetario", valorSinRedondeoPrematuro);
  it("cuenta carga actual y completadas dentro del periodo inclusive", cargaConPeriodo);
  it("cuenta órdenes sin responsable aunque carezcan de etapas y excluye terminales", async () => {
    const anterior = await reporte("carga-por-operario");
    const antes = anterior.filas.find((fila) => fila.responsableId === null);
    const orden = await crearOrdenPanel(entorno, { responsableId: null });
    await crearOrdenPanel(entorno, { responsableId: null, estado: "CANCELADA" });
    const sinEtapas = await reporte("carga-por-operario");
    const fila = sinEtapas.filas.find((fila) => fila.responsableId === null);
    expect(fila).toMatchObject({ responsable: "Sin responsable", ordenes: Number(antes?.ordenes ?? 0) + 1 });
    const area = await db.area.create({ data: { nombre: `Reporte sin responsable ${orden.id}` } });
    await db.etapaOrden.create({ data: { ordenId: orden.id, areaId: area.id, nombre: "Pendiente sin responsable", secuencia: 1 } });
    const actual = await reporte("carga-por-operario");
    expect(actual.filas.find((fila) => fila.responsableId === null))
      .toMatchObject({ ordenes: Number(antes?.ordenes ?? 0) + 1, pendientes: Number(antes?.pendientes ?? 0) + 1 });
    expect(actual.totales.ordenes).toBe(actual.filas.reduce((total, fila) => total + Number(fila.ordenes), 0));
  });
  it("agrupa únicamente la primera etapa abierta y excluye terminales", primeraEtapa);
  it("incluye órdenes sin etapa abierta", sinEtapaAbierta);
  it("incluye límites locales y excluye instantes adyacentes", bordesCotizaciones);
  it("omite dinero incluso con reporte:ver concedido", sinDineroConReporte);
  it("consulta existencias con una sola consulta SQL", consultaUnicaInventario);
  it("incluye ajustes solicitados en conteos e importes", ajustesSolicitados);
  it("responde vacío con totales cero", async () => {
    expect(await reporte("existencias", { texto: `inexistente-${entorno.sesiones.GERENCIA.usuarioId}` })).toMatchObject({
      filas: [], totales: { materiales: 0, enAlerta: 0, sinExistencia: 0, valorInventario: formatear(CERO, 2) } });
  });
});
