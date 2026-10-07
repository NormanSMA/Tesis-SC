import { expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { nombreBaseDeDatos, urlPropietario } from "../helpers/entorno-bd";
import { consumir, crearMaterial, devolver, registrarEntrada } from "./inventario-consumo-ayudas";
import { crearOrden } from "./ordenes-ayudas";
import { prepararProduccion } from "./produccion-ayudas";

export type EntornoTrazabilidad = Awaited<ReturnType<typeof prepararTrazabilidad>>;
export async function prepararTrazabilidad(db: PrismaClient) {
  if (!nombreBaseDeDatos(urlPropietario()).endsWith("_test")) throw new Error("Use una base terminada en _test.");
  const produccion = await prepararProduccion(db);
  const servicio = await import("@/modules/trazabilidad/service");
  const global = await import("@/app/api/v1/bitacora/route");
  const orden = await import("@/app/api/v1/ordenes/[id]/trazabilidad/route");
  return { db, produccion, servicio, rutas: { global, orden }, sesiones: produccion.ordenes.sesiones };
}
export function comprobarSinDinero(valor: unknown): void {
  if (!valor || typeof valor !== "object") return;
  for (const [clave, dato] of Object.entries(valor)) {
    expect(clave).not.toMatch(/^(costo\w*|precio\w*|importe\w*|subtotal|descuento|impuesto|total\w*|totales|margen\w*|tasaImpuesto)$/i);
    comprobarSinDinero(dato);
  }
}
export function comprobarSinCliente(valor: unknown): void {
  if (!valor || typeof valor !== "object") return;
  for (const [clave, dato] of Object.entries(valor)) {
    expect(clave).not.toMatch(/^(ruc|direccion)$/i); comprobarSinCliente(dato);
  }
}
export async function crearTrabajo(entorno: EntornoTrazabilidad) {
  const orden = await crearOrden(entorno.produccion.ordenes);
  const asignada = await entorno.produccion.servicio.editarEtapa(orden.etapas[0].id,
    { version: orden.etapas[0].actualizadoEn, responsableId: entorno.sesiones.PRODUCCION.usuarioId }, entorno.sesiones.PRODUCCION.actor);
  await entorno.produccion.servicio.iniciarEtapa(asignada.id, { version: asignada.actualizadoEn }, entorno.sesiones.PRODUCCION.actor);
  return orden;
}
export async function libroConCostos(entorno: EntornoTrazabilidad) {
  const orden = await crearTrabajo(entorno);
  const consumo = entorno.produccion.consumo;
  const primero = await crearMaterial(consumo, { existencia: "10", costo: "12.3456" });
  const segundo = await crearMaterial(consumo, { existencia: "20", costo: "7.1234" });
  await entorno.db.consumoEstimado.createMany({ data: [
    { ordenId: orden.id, materialId: primero.id, cantidad: "4.000", origen: "RECETA" },
    { ordenId: orden.id, materialId: segundo.id, cantidad: "2.000", origen: "RECETA" },
  ] });
  await consumir(consumo, { ordenId: orden.id, lineas: [{ materialId: primero.id, cantidad: "3.333" }, { materialId: segundo.id, cantidad: "2.001" }] });
  await registrarEntrada(consumo, { materialId: primero.id, cantidad: "5", costo: "20.6789" });
  await devolver(consumo, { ordenId: orden.id, lineas: [{ materialId: primero.id, cantidad: "1.111" }] });
  return { orden, primero, segundo };
}
export async function inyectarDetalle(entorno: EntornoTrazabilidad, ordenId: string) {
  return entorno.db.bitacora.create({ data: { entidad: "ORDEN_TRABAJO", entidadId: ordenId, ordenId,
    usuarioId: entorno.sesiones.GERENCIA.usuarioId, accion: "EDITAR", detalle: {
      motivo: "Detalle visible", secreto: "NO_MOSTRAR", total: "98765.43", costoTotal: "34567.89",
      cambios: { nombre: { anterior: "A", nuevo: "B", costoUnitario: "222" },
        precioBase: { anterior: "111", nuevo: "333" }, ruc: { anterior: null, nuevo: "RUC_PRIVADO" },
        direccion: { anterior: null, nuevo: "DIRECCION_PRIVADA" }, desconocido: { total: "444" } },
      totales: { anterior: { total: "555", desconocido: "666" }, nuevo: { total: "777" } },
    } } });
}
