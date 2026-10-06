import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { registrarEvento } from "@/lib/bitacora";
import type { Actor } from "@/core/autorizacion";

import type { ItemCalculado } from "./costear";
import { actualizarCondicionado, buscarCotizacion, type FichaGuardada } from "./repo";
import { conflictoEdicion, noEncontrado, regla } from "./errores";

export async function exigirCotizacion(tx: Tx, id: string): Promise<FichaGuardada> {
  const ficha = await buscarCotizacion(tx, id);
  if (!ficha) throw noEncontrado();
  return ficha;
}

export function exigirBorrador(ficha: FichaGuardada): void {
  if (ficha.estado !== "BORRADOR") throw regla("COTIZACION_CONGELADA", "Solo se puede editar una cotización en borrador. Duplíquela para corregirla.");
  if (ficha.archivada) throw regla("COTIZACION_ARCHIVADA", "La cotización está archivada.");
}

export async function tomarVersion(tx: Tx, id: string, version: string): Promise<FichaGuardada> {
  const ficha = await exigirCotizacion(tx, id);
  if (ficha.actualizadoEn.getTime() !== new Date(version).getTime()) throw conflictoEdicion();
  const condicion = { id, estado: ficha.estado, archivada: ficha.archivada, version };
  if (!(await actualizarCondicionado(tx, condicion))) throw conflictoEdicion();
  return exigirCotizacion(tx, id);
}

export async function guardarCabecera(tx: Tx, ficha: FichaGuardada, cambios: Prisma.CotizacionUncheckedUpdateInput): Promise<void> {
  // Prisma asignaría su reloj al actualizar: conservar el avance monotónico del UPDATE condicionado.
  await tx.cotizacion.update({ where: { id: ficha.id }, data: { ...cambios, actualizadoEn: ficha.actualizadoEn } });
}

export async function guardarItems(tx: Tx, cotizacionId: string, items: ItemCalculado[]): Promise<void> {
  await tx.lineaCosto.deleteMany({ where: { item: { cotizacionId } } });
  await tx.itemCotizacion.deleteMany({ where: { cotizacionId } });
  for (const item of items) {
    const { lineas, ...columnas } = item;
    await tx.itemCotizacion.create({ data: { ...columnas, cotizacionId } });
    if (lineas.length) await tx.lineaCosto.createMany({ data: lineas.map((linea) => ({ ...linea, itemId: item.id })) });
  }
}

type DatosEvento = {
  ficha: FichaGuardada; actor: Actor; accion: "CREAR" | "EDITAR" | "CAMBIAR_ESTADO" | "ARCHIVAR";
  detalle?: Prisma.InputJsonObject; estadoAnterior?: string; estadoNuevo?: string;
};
export function registrarCambio(tx: Tx, evento: DatosEvento): Promise<void> {
  return registrarEvento(tx, { entidad: "COTIZACION", entidadId: evento.ficha.id,
    actorId: evento.actor.id, accion: evento.accion, detalle: evento.detalle,
    estadoAnterior: evento.estadoAnterior, estadoNuevo: evento.estadoNuevo });
}
