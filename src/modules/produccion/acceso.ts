import { can, type Actor } from "@/core/autorizacion";
import type { Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { Prisma } from "@/generated/prisma/client";

export function soloEtapasPropias(actor: Actor) {
  return actor.perfiles.includes("PRODUCCION") && !can(actor, "produccion:planificar");
}

type EtapaAcceso = { id: string; secuencia: number; estado: string; responsableId: string | null };

type OrdenAcceso = { responsableId: string | null; etapas: readonly Pick<EtapaAcceso, "responsableId">[] };

/** El personal de Producción solo conoce las órdenes en las que participa: responsable general o de alguna etapa. */
export function participaEnOrden(orden: OrdenAcceso, actor: Actor) {
  return orden.responsableId === actor.id || orden.etapas.some(etapa => etapa.responsableId === actor.id);
}
export function filtroParticipacion(actor: Actor): Prisma.OrdenTrabajoWhereInput {
  return soloEtapasPropias(actor)
    ? { OR: [{ responsableId: actor.id }, { etapas: { some: { responsableId: actor.id } } }] } : {};
}
export function exigirParticipacion(actor: Actor, orden: OrdenAcceso) {
  if (soloEtapasPropias(actor) && !participaEnOrden(orden, actor)) throw new AppError({
    status: 404, codigo: "NO_ENCONTRADO", mensaje: "La orden no existe.",
  });
}
// Quien participa ve todas las etapas de la orden, también las de sus compañeros.
export function etapasVisibles<T extends Pick<EtapaAcceso, "responsableId">>(orden: { responsableId: string | null; etapas: T[] }, actor: Actor) {
  return !soloEtapasPropias(actor) || participaEnOrden(orden, actor) ? orden.etapas : [];
}
/** Etapas propias habilitadas: todas las anteriores están completadas u omitidas. undefined = sin restricción. */
export function etapasEjecutables(etapas: readonly EtapaAcceso[], actor: Actor): string[] | undefined {
  if (!soloEtapasPropias(actor)) return undefined;
  return etapas.filter(etapa => etapa.responsableId === actor.id && etapas.every(anterior =>
    anterior.secuencia >= etapa.secuencia || ["COMPLETADA", "OMITIDA"].includes(anterior.estado))).map(etapa => etapa.id);
}

export async function idsEtapasDisponibles(tx: Tx, actor: Actor) {
  const filas = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT e.id FROM etapa_orden e WHERE e.responsable_id = ${actor.id}::uuid
    AND NOT EXISTS (SELECT 1 FROM etapa_orden anterior WHERE anterior.orden_id = e.orden_id
      AND anterior.secuencia < e.secuencia AND anterior.estado NOT IN ('COMPLETADA', 'OMITIDA'))`);
  return filas.map(fila => fila.id);
}

export async function exigirEjecucion(tx: Tx, etapa: { ordenId: string; secuencia: number; responsableId: string | null }, actor: Actor) {
  if (soloEtapasPropias(actor) && etapa.responsableId !== actor.id) throw new AppError({
    status: 403, codigo: "SIN_PERMISO", mensaje: "Solo puede actualizar sus etapas asignadas.",
  });
  if (await tx.etapaOrden.count({ where: { ordenId: etapa.ordenId, secuencia: { lt: etapa.secuencia },
    estado: { notIn: ["COMPLETADA", "OMITIDA"] } } })) throw new AppError({
    status: 409, codigo: "ETAPA_ANTERIOR_PENDIENTE", mensaje: "Complete las etapas anteriores antes de continuar.",
  });
}
