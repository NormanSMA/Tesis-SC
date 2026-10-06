import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import type { EstadoOrden, PrismaClient } from "@/generated/prisma/client";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { EntradaCrearOrden } from "@/modules/ordenes/schema";
import { crearCliente } from "@/lib/db";
import { sembrar } from "../../prisma/seed/sembrar";

export type EntornoOrdenes = Awaited<ReturnType<typeof prepararOrdenes>>;

type Manejador = (req: Request, contexto?: { params?: Promise<Record<string, string>> }) => Promise<Response>;
export async function invocar<T = unknown>(manejador: Manejador, solicitud: Request, id?: string) {
  const respuesta = await manejador(solicitud, id ? { params: Promise.resolve({ id }) } : undefined);
  const cuerpo = await respuesta.json() as Record<string, unknown>;
  return { status: respuesta.status, datos: cuerpo.datos as T, cuerpo,
    error: cuerpo.error as { codigo: string; mensaje: string; campos?: Record<string, string> } | undefined };
}

// El setup de órdenes usa Node y conserva las filas: el setup general depende de pnpm y borra el esquema.
export default async function prepararBaseOrdenes(project: TestProject) {
  const texto = process.env.TEST_DATABASE_URL;
  if (!texto) throw new Error("Falta TEST_DATABASE_URL.");
  const url = new URL(texto);
  if (url.pathname !== "/ord_test" || url.hostname !== "127.0.0.1" || url.port !== "5443") {
    throw new Error("Las pruebas de órdenes requieren ord_test en 127.0.0.1:5443.");
  }
  const raiz = path.resolve(import.meta.dirname, "..", "..");
  const migracion = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    cwd: raiz, env: { ...process.env, DATABASE_URL_MIGRACION: texto }, encoding: "utf8",
  });
  if (migracion.status !== 0) throw new Error(`Falló la migración de ord_test: ${migracion.stdout}\n${migracion.stderr}`);
  url.searchParams.delete("schema");
  const cliente = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
  try {
    await cliente.connect();
    if (!process.env.APP_DB_PASSWORD) throw new Error("Falta APP_DB_PASSWORD.");
    await cliente.query("SELECT set_config('sc.rol', $1, false), set_config('sc.clave', $2, false)", [
      process.env.APP_DB_USER ?? "sc_app", process.env.APP_DB_PASSWORD,
    ]);
    await cliente.query(readFileSync(path.join(raiz, "scripts/db/roles.sql"), "utf8"));
  } finally { await cliente.end(); }
  const db = crearCliente(texto);
  try { await sembrar(db, { env: process.env, silenciosa: true }); } finally { await db.$disconnect(); }
  project.provide("baseDisponible", true);
}

export async function prepararOrdenes(db: PrismaClient) {
  const { prepararCotizaciones, abrirSesion, nombreUnico } = await import("./cotizaciones-ayudas");
  const cotizaciones = await prepararCotizaciones(db);
  const produccion = await abrirSesion(db, cotizaciones.modulos, "PRODUCCION");
  const gerencia = await abrirSesion(db, cotizaciones.modulos, "GERENCIA");
  const admin = await abrirSesion(db, cotizaciones.modulos, "ADMIN");
  const area = await db.area.create({ data: { nombre: nombreUnico("Área órdenes") } });
  const categoriaId = cotizaciones.referencias.categoria.id;
  await db.etapaPlantilla.createMany({ data: [
    { categoriaId, areaId: area.id, nombre: "Diseño", secuencia: 1 },
    { categoriaId, areaId: area.id, nombre: "Impresión", secuencia: 2 },
    { categoriaId, areaId: area.id, nombre: "Plantilla archivada", secuencia: 3, activo: false },
  ] });
  await db.recetaProducto.createMany({ data: [
    { productoId: cotizaciones.referencias.unidad.id, materialId: cotizaciones.referencias.material.id, cantidad: "1.250" },
    { productoId: cotizaciones.referencias.superficie.id, materialId: cotizaciones.referencias.material.id, cantidad: "0.500" },
  ] });
  const modulos = {
    lista: await import("@/app/api/v1/ordenes/route"), ficha: await import("@/app/api/v1/ordenes/[id]/route"),
    entregar: await import("@/app/api/v1/ordenes/[id]/entregar/route"), cerrar: await import("@/app/api/v1/ordenes/[id]/cerrar/route"),
    cancelar: await import("@/app/api/v1/ordenes/[id]/cancelar/route"), opciones: await import("@/app/api/v1/ordenes/opciones/route"),
    servicio: await import("@/modules/ordenes/service"),
  };
  return { cotizaciones, modulos, sesiones: { VENTAS: cotizaciones.ventas, PRODUCCION: produccion, GERENCIA: gerencia, ADMIN: admin } };
}

export async function crearAprobada(entorno: EntornoOrdenes, items?: EntradaItem[]) {
  const { crearBorrador, itemsMixtos } = await import("./cotizaciones-ayudas");
  const { cotizaciones } = entorno;
  const borrador = await crearBorrador(cotizaciones, { items: items ?? itemsMixtos(cotizaciones.referencias) });
  const enviada = await cotizaciones.modulos.servicio.enviarCotizacion(borrador.id, borrador.actualizadoEn, cotizaciones.ventas.actor);
  return cotizaciones.modulos.servicio.responderCotizacion(enviada.id, { version: enviada.actualizadoEn, resultado: "APROBADA" }, cotizaciones.ventas.actor);
}

export function entradaConversion(entorno: EntornoOrdenes, cotizacionId: string): EntradaCrearOrden {
  return { cotizacionId, categoriaId: entorno.cotizaciones.referencias.categoria.id,
    responsableId: entorno.sesiones.PRODUCCION.usuarioId, fechaEntrega: entorno.cotizaciones.modulos.fechas.hoyManagua(),
    especificaciones: "Trabajo de integración" };
}

export async function crearOrden(entorno: EntornoOrdenes) {
  const cotizacion = await crearAprobada(entorno);
  return entorno.modulos.servicio.crearOrden(entradaConversion(entorno, cotizacion.id), entorno.sesiones.VENTAS.actor);
}

export async function ponerEstado(db: PrismaClient, id: string, destino: EstadoOrden): Promise<void> {
  if (destino === "PENDIENTE") return;
  const inicio = new Date(Date.now() - 1000);
  await db.ordenTrabajo.update({ where: { id }, data: { estado: "EN_PRODUCCION", fechaInicioReal: inicio } });
  if (destino === "EN_PRODUCCION") return;
  if (destino === "CANCELADA") {
    await db.ordenTrabajo.update({ where: { id }, data: { estado: destino, motivoCancelacion: "Cancelación de prueba" } });
    return;
  }
  await db.ordenTrabajo.update({ where: { id }, data: { estado: "LISTA" } });
  if (destino === "LISTA") return;
  await db.ordenTrabajo.update({ where: { id }, data: { estado: "ENTREGADA", fechaEntregaReal: new Date() } });
  if (destino === "CERRADA") await db.ordenTrabajo.update({ where: { id }, data: { estado: "CERRADA", fechaCierre: new Date() } });
}

export async function leerOrden(entorno: EntornoOrdenes, id: string) {
  return entorno.modulos.servicio.obtenerOrden(id, entorno.sesiones.VENTAS.actor);
}
