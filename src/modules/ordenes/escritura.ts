import type { Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { conflictoEdicion, noEncontrado, traducirError } from "./errores";
import { actualizarCondicionado, buscarOrden, type CambiosOrden, type FichaGuardada } from "./repo";

export async function exigirOrden(tx: Tx, id: string): Promise<FichaGuardada> {
  const orden = await buscarOrden(tx, id);
  if (!orden) throw noEncontrado();
  return orden;
}

export async function leerVersion(tx: Tx, id: string, version: string): Promise<FichaGuardada> {
  const actual = await exigirOrden(tx, id);
  if (actual.actualizadoEn.getTime() !== new Date(version).getTime()) throw conflictoEdicion();
  return actual;
}

export async function guardarCambios(tx: Tx, actual: FichaGuardada, cambios: CambiosOrden): Promise<FichaGuardada> {
  if (!await actualizarCondicionado(tx, { id: actual.id, estado: actual.estado, version: actual.actualizadoEn.toISOString() }, cambios)) {
    throw conflictoEdicion();
  }
  return exigirOrden(tx, actual.id);
}

export async function validarResponsable(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${id}::uuid FOR SHARE`;
  const responsable = await tx.usuario.findFirst({ where: { id, activo: true, perfiles: { some: { perfil: { codigo: "PRODUCCION" } } } } });
  if (!responsable) throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.",
    campos: { responsableId: "Seleccione un usuario activo de Producción." } });
}

type DatosEvento = { ordenId: string; actor: Actor; accion: "CONVERTIR_EN_ORDEN" | "EDITAR" | "ASIGNAR_RESPONSABLE" | "CAMBIAR_ESTADO";
  cotizacionId?: string; detalle?: Prisma.InputJsonObject; estadoAnterior?: string; estadoNuevo?: string };
export function registrarCambio(tx: Tx, evento: DatosEvento): Promise<void> {
  return registrarEvento(tx, { entidad: "ORDEN_TRABAJO", entidadId: evento.ordenId,
    actorId: evento.actor.id, accion: evento.accion, cotizacionId: evento.cotizacionId, detalle: evento.detalle,
    estadoAnterior: evento.estadoAnterior, estadoNuevo: evento.estadoNuevo });
}

export async function transaccionOrden<T>(operacion: (tx: Tx) => Promise<T>): Promise<T> {
  try { return await prisma.$transaction(operacion); } catch (error) { traducirError(error); }
}
