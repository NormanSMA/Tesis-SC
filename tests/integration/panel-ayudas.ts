import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import type { EstadoCotizacion, Prisma, PrismaClient } from "@/generated/prisma/client";
import type { NombreReporte } from "@/modules/reportes/schema";
import type { PanelDto } from "@/modules/panel/tipos";
import { nombreBaseDeDatos, urlParaPg, urlPropietario } from "../helpers/entorno-bd";

export type EntornoPanel = Awaited<ReturnType<typeof prepararPanel>>;
export async function prepararPanel(db: PrismaClient) {
  if (!nombreBaseDeDatos(urlPropietario()).endsWith("_test")) throw new Error("Use una base terminada en _test.");
  const { prepararOrdenes } = await import("./ordenes-ayudas");
  const ordenes = await prepararOrdenes(db);
  return { db, ordenes, sesiones: ordenes.sesiones,
    servicio: await import("@/modules/panel/service"), reportes: await import("@/modules/reportes/service"),
    panel: await import("@/app/api/v1/panel/route"), rutaReporte: await import("@/app/api/v1/reportes/[nombre]/route") };
}
export async function crearCotizacionPanel(entorno: EntornoPanel, entrada: {
  estado?: EstadoCotizacion; total?: string; creadoEn?: string; vencimiento?: string; archivada?: boolean;
  respuesta?: string; origenId?: string; version?: number; moneda?: "NIO" | "USD"; tipoCambio?: string;
} = {}) {
  const vence = entrada.vencimiento ?? "2034-05-10";
  const emision = new Date(`${vence}T00:00:00Z`);
  emision.setUTCDate(emision.getUTCDate() - 15);
  return entorno.db.$transaction(async (tx) => {
    const creadoEn = new Date(entrada.creadoEn ?? "2034-05-01T12:00:00Z");
    const [numeracion] = await tx.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('COTIZACION', ${creadoEn}) AS numero`;
    const total = entrada.total ?? "0";
    const nueva = await tx.cotizacion.create({ data: {
      numero: numeracion.numero, clienteId: entorno.ordenes.cotizaciones.referencias.cliente.id,
      creadoPorId: entorno.sesiones.ATENCION_CLIENTE.usuarioId, asunto: "Prueba panel", subtotal: total, total,
      tasaImpuesto: "0", descuento: "0", impuesto: "0", vigenciaDias: 15,
      fechaEmision: emision, fechaVencimiento: new Date(vence), creadoEn,
      cotizacionOrigenId: entrada.origenId, version: entrada.version,
      moneda: entrada.moneda, tipoCambio: entrada.tipoCambio,
    } });
    await tx.itemCotizacion.create({ data: { cotizacionId: nueva.id, tipo: "CATALOGO", secuencia: 1,
      productoId: entorno.ordenes.cotizaciones.referencias.unidad.id, categoriaId: entorno.ordenes.cotizaciones.referencias.categoria.id,
      descripcion: "Ítem de prueba", unidadCobro: "UNIDAD", cantidad: "1", precioUnitario: total, importe: total } });
    const destino = entrada.estado ?? "BORRADOR";
    if (destino !== "BORRADOR") await tx.cotizacion.update({ where: { id: nueva.id }, data: { estado: "ENVIADA" } });
    if (destino !== "BORRADOR" && destino !== "ENVIADA") await tx.cotizacion.update({ where: { id: nueva.id },
      data: { estado: destino, fechaRespuesta: ["APROBADA", "RECHAZADA", "AJUSTE_SOLICITADO"].includes(destino) ? new Date(entrada.respuesta ?? emision.toISOString()) : null,
        motivoRechazo: destino === "RECHAZADA" ? "Rechazo de prueba" : null,
        motivoAjuste: destino === "AJUSTE_SOLICITADO" ? "Ajuste de prueba" : null,
        ...(destino === "APROBADA" ? { usuarioAprobacionId: entorno.sesiones.OPERACIONES.usuarioId, referenciaAprobacion: "Correo del cliente" } : {}) } });
    if (entrada.archivada) await tx.cotizacion.update({ where: { id: nueva.id }, data: { archivada: true } });
    return tx.cotizacion.findUniqueOrThrow({ where: { id: nueva.id } });
  });
}
export async function crearOrdenPanel(entorno: EntornoPanel, opciones: {
  fechaEntrega?: string; estado?: "PENDIENTE" | "EN_PRODUCCION" | "CANCELADA"; responsableId?: string | null;
} = {}) {
  const cotizacion = await crearCotizacionPanel(entorno, { estado: "APROBADA" });
  const estado = opciones.estado ?? "PENDIENTE";
  return entorno.db.$transaction(async (tx) => {
    const [numeracion] = await tx.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('ORDEN_TRABAJO') AS numero`;
    const nueva = await tx.ordenTrabajo.create({ data: { numero: numeracion.numero, cotizacionId: cotizacion.id, clienteId: cotizacion.clienteId,
      categoriaId: entorno.ordenes.cotizaciones.referencias.categoria.id,
      responsableId: opciones.responsableId === undefined ? entorno.sesiones.PRODUCCION.usuarioId : opciones.responsableId,
      creadoPorId: entorno.sesiones.OPERACIONES.usuarioId, fechaEntrega: new Date(opciones.fechaEntrega ?? "2034-05-10") } });
    return estado === "PENDIENTE" ? nueva : tx.ordenTrabajo.update({ where: { id: nueva.id }, data: {
      estado, fechaInicioReal: estado === "EN_PRODUCCION" ? new Date("2034-05-01T12:00:00Z") : null,
      motivoCancelacion: estado === "CANCELADA" ? "Cancelación de prueba" : null } });
  });
}
export async function crearEtapaPanel(entorno: EntornoPanel, entrada: Prisma.EtapaOrdenUncheckedCreateInput) {
  return entorno.db.$transaction(async (tx) => {
    const etapa = await tx.etapaOrden.create({ data: { ...entrada, estado: "PENDIENTE", fechaInicioReal: null, fechaFinReal: null } });
    if (entrada.estado === "OMITIDA") return tx.etapaOrden.update({ where: { id: etapa.id }, data: { estado: "OMITIDA" } });
    if (entrada.estado === "EN_CURSO" || entrada.estado === "COMPLETADA") {
      await tx.etapaOrden.update({ where: { id: etapa.id }, data: { estado: "EN_CURSO", fechaInicioReal: entrada.fechaInicioReal } });
    }
    if (entrada.estado === "COMPLETADA") await tx.etapaOrden.update({ where: { id: etapa.id }, data: { estado: "COMPLETADA", fechaFinReal: entrada.fechaFinReal } });
    return tx.etapaOrden.findUniqueOrThrow({ where: { id: etapa.id } });
  });
}
export async function completarEtapaPanel(entorno: EntornoPanel, entrada: {
  ordenId: string; areaId: string; responsableId: string; usuarioId: string; secuencia: number; instante: string;
}) {
  const etapa = await crearEtapaPanel(entorno, { ordenId: entrada.ordenId, areaId: entrada.areaId,
    nombre: "Etapa completada", secuencia: entrada.secuencia, responsableId: entrada.responsableId,
    estado: "COMPLETADA", fechaInicioReal: new Date(entrada.instante), fechaFinReal: new Date(entrada.instante) });
  await entorno.db.historialEtapa.create({ data: { ordenId: entrada.ordenId, etapaId: etapa.id,
    usuarioId: entrada.usuarioId, responsableId: entrada.responsableId, estadoAnterior: "EN_CURSO",
    estadoNuevo: "COMPLETADA", creadoEn: new Date(entrada.instante) } });
  return etapa;
}
export async function crearMaterialPanel(entorno: EntornoPanel, entrada: {
  nombre?: string; existencia?: string; minimo?: string; costo?: string; activo?: boolean;
} = {}) {
  const material = await entorno.db.material.create({ data: { codigo: `PAN-${randomUUID().slice(0, 12)}`,
    nombre: entrada.nombre ?? `Material ${randomUUID().slice(0, 8)}`, unidad: "METRO", stockMinimo: entrada.minimo ?? "2.000",
    costoPromedio: entrada.costo ?? "1.2345", activo: entrada.activo ?? true } });
  if (entrada.existencia && entrada.existencia !== "0") await entorno.db.movimientoInventario.create({ data: {
    materialId: material.id, tipo: "ENTRADA", cantidad: entrada.existencia, costoUnitario: entrada.costo ?? "1.2345",
    usuarioId: entorno.sesiones.ADMINISTRACION.usuarioId, existenciaResultante: "0", costoPromedioResultante: "0" } });
  return material;
}
export function clavesMonetarias(valor: unknown): string[] {
  if (typeof valor === "string" && /C\$|córdobas|costo promedio|monto aprobado|valor del inventario/i.test(valor)) return [valor];
  if (!valor || typeof valor !== "object") return [];
  return Object.entries(valor).flatMap(([clave, dato]) => [
    ...(/^(costo\w*|precio\w*|importe\w*|subtotal|descuento|impuesto|total|valorInventario|margen\w*|tasaImpuesto)$/i.test(clave) ? [clave] : []),
    ...clavesMonetarias(dato),
  ]);
}
export function valorIndicador(panel: PanelDto, id: string): number {
  const indicador = panel.indicadores.find((fila) => fila.id === id);
  if (!indicador) throw new Error(`No existe el indicador ${id}.`);
  return Number(indicador.valor.replace(/,/g, ""));
}
export function solicitarReporte(entorno: EntornoPanel, entrada: { nombre: NombreReporte | string; parametros?: string; cookie?: string }) {
  return entorno.rutaReporte.GET(new Request(`http://localhost/api/v1/reportes/${entrada.nombre}?${entrada.parametros ?? ""}`,
    { headers: entrada.cookie ? { cookie: entrada.cookie } : undefined }), { params: Promise.resolve({ nombre: entrada.nombre }) });
}

// Evita pnpm en el sandbox y preserva los datos de bases de prueba ya preparadas.
export default async function prepararBasePanel(proyecto: TestProject) {
  const url = urlPropietario();
  if (!nombreBaseDeDatos(url).endsWith("_test")) throw new Error("Use una base terminada en _test.");
  const raiz = process.cwd();
  const resultado = spawnSync(process.execPath, [path.join(raiz, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    cwd: raiz, env: { ...process.env, DATABASE_URL_MIGRACION: url }, encoding: "utf8",
  });
  if (resultado.status !== 0) throw new Error(`No se pudo preparar la base: ${resultado.stdout}\n${resultado.stderr}`);
  const cliente = new Client({ connectionString: urlParaPg(url), connectionTimeoutMillis: 3000 });
  try {
    await cliente.connect();
    const clave = process.env.APP_DB_PASSWORD;
    if (!clave) throw new Error("Falta APP_DB_PASSWORD.");
    await cliente.query("SELECT set_config('sc.rol', $1, false), set_config('sc.clave', $2, false)", [process.env.APP_DB_USER ?? "sc_app", clave]);
    await cliente.query(readFileSync(path.join(raiz, "scripts/db/roles.sql"), "utf8"));
    proyecto.provide("baseDisponible", true);
  } finally { await cliente.end(); }
}
