import { randomUUID } from "node:crypto";
import type { Actor } from "@/core/autorizacion";
import type { EstadoOrden, PrismaClient } from "@/generated/prisma/client";
import type { RespuestaMovimientosOrden } from "@/modules/inventario/contrato-orden";
import { ORIGEN } from "../helpers/auth";
import { crearMaterialBase } from "../helpers/fabricas";
import { abrirSesion, nombreUnico } from "./cotizaciones-ayudas";
import { crearAprobada, entradaConversion, ponerEstado, prepararOrdenes, type EntornoOrdenes } from "./ordenes-ayudas";

export type EntornoConsumo = Awaited<ReturnType<typeof prepararConsumo>>;
export type Linea = { materialId: string; cantidad: string };
export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: { codigo?: string; status?: number; campos?: Record<string, string>; mensaje?: string } };

// Importa las rutas después de prepararOrdenes: cargarAuth reinicia los módulos y apunta db.ts a la base de pruebas.
export async function prepararConsumo(db: PrismaClient) {
  const ordenes = await prepararOrdenes(db);
  const { modulos: modulosCotizaciones } = ordenes.cotizaciones;
  const ADMINISTRACION = await abrirSesion(db, modulosCotizaciones, "ADMINISTRACION");
  const OPERACIONES = await abrirSesion(db, modulosCotizaciones, "OPERACIONES");
  const sesiones = { ...ordenes.sesiones, ADMINISTRACION, OPERACIONES };
  const modulos = {
    consumos: await import("@/app/api/v1/ordenes/[id]/consumos/route"),
    devoluciones: await import("@/app/api/v1/ordenes/[id]/devoluciones/route"),
    servicio: await import("@/modules/inventario/consumo"),
    resumen: await import("@/modules/inventario/resumen-orden"),
  };
  // administracion consume y registra entradas; produccion queda para etapas de otros módulos.
  return { db, ordenes, modulos, sesiones, administracion: ADMINISTRACION.actor, produccion: ordenes.sesiones.PRODUCCION.actor };
}

type OpcionesMaterial = { existencia?: string; costo?: string; activo?: boolean };

/** Material propio con existencia inicial por ENTRADA (la base no admite otra vía, SC006). */
export async function crearMaterial(entorno: EntornoConsumo, opciones: OpcionesMaterial = {}) {
  const material = await entorno.db.material.create({ data: crearMaterialBase({ codigo: nombreUnico("MC").slice(0, 30),
    nombre: nombreUnico("Material consumo"), costoPromedio: opciones.costo ?? "10" }) });
  if (opciones.existencia && Number(opciones.existencia) > 0) {
    await registrarEntrada(entorno, { materialId: material.id, cantidad: opciones.existencia, costo: opciones.costo });
  }
  if (opciones.activo === false) await entorno.db.material.update({ where: { id: material.id }, data: { activo: false } });
  return material;
}

type Entrada = { materialId: string; cantidad: string; costo?: string };

export function registrarEntrada(entorno: EntornoConsumo, { materialId, cantidad, costo = "10" }: Entrada) {
  return entorno.db.movimientoInventario.create({ data: { materialId, tipo: "ENTRADA", cantidad, costoUnitario: costo,
    usuarioId: entorno.sesiones.ADMINISTRACION.usuarioId, referencia: "Factura prueba" } });
}

export async function nuevaOrden(entorno: EntornoConsumo, estado: EstadoOrden = "PENDIENTE") {
  const aprobada = await crearAprobada(entorno.ordenes);
  const orden = await entorno.ordenes.modulos.servicio.crearOrden(entradaConversion(entorno.ordenes, aprobada.id), entorno.sesiones.OPERACIONES.actor);
  await ponerEstado(entorno.db, orden.id, estado);
  return orden;
}

type Movimiento = { ordenId: string; lineas: Linea[]; actor?: Actor; clave?: string };

export function consumir(entorno: EntornoConsumo, datos: Movimiento): Promise<RespuestaMovimientosOrden> {
  return entorno.modulos.servicio.registrarConsumo({ ordenId: datos.ordenId, entrada: { lineas: datos.lineas },
    clave: datos.clave ?? randomUUID(), actor: datos.actor ?? entorno.administracion });
}

export function devolver(entorno: EntornoConsumo, datos: Movimiento): Promise<RespuestaMovimientosOrden> {
  return entorno.modulos.servicio.registrarDevolucion({ ordenId: datos.ordenId, entrada: { lineas: datos.lineas },
    clave: datos.clave ?? randomUUID(), actor: datos.actor ?? entorno.administracion });
}

export async function capturar<T>(promesa: Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await promesa };
  } catch (error) {
    return { ok: false, error: error as Extract<Resultado<T>, { ok: false }>["error"] };
  }
}

/** Existencia guardada y suma del libro en una sola consulta (misma instantánea). */
export async function conciliar(db: PrismaClient, materialId: string) {
  const [fila] = await db.$queryRaw<{ existencia: string; libro: string }[]>`
    SELECT m.existencia::text AS existencia,
           (SELECT COALESCE(SUM(v.cantidad), 0) FROM movimiento_inventario v WHERE v.material_id = m.id)::numeric(14,3)::text AS libro
      FROM material m WHERE m.id = ${materialId}::uuid`;
  return fila;
}

/** Movimientos de la orden y eventos de bitácora: deben corresponder uno a uno. */
export async function trazaOrden(db: PrismaClient, ordenId: string) {
  const enlaces = await db.consumoOrden.findMany({ where: { ordenId }, select: { movimientoId: true } });
  const eventos = await db.bitacora.findMany({ where: { ordenId, entidad: "MOVIMIENTO_INVENTARIO" }, select: { entidadId: true } });
  return { movimientos: enlaces.map((e) => e.movimientoId).sort(), eventos: eventos.map((e) => e.entidadId).sort() };
}

type OpcionesPeticion = { cookie?: string; cuerpo?: unknown; clave?: string | null; metodo?: string };

export function peticionOrden(ruta: string, opciones: OpcionesPeticion = {}): Request {
  const encabezados: Record<string, string> = { origin: ORIGEN };
  if (opciones.cookie) encabezados.cookie = opciones.cookie;
  if (opciones.cuerpo !== undefined) encabezados["content-type"] = "application/json";
  if (opciones.clave !== null) encabezados["idempotency-key"] = opciones.clave ?? randomUUID();
  return new Request(`${ORIGEN}${ruta}`, { method: opciones.metodo ?? "POST", headers: encabezados,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo) });
}

export type { EntornoOrdenes };
