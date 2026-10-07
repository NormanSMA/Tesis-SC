import type { Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { exigirVersion, noEncontrado, traducirError } from "./errores";
import { bloquearEtapa, type EtapaGuardada } from "./repo";
import { exigirOrdenEditable } from "./reglas";

export async function transaccionProduccion<T>(operacion: (tx: Tx) => Promise<T>): Promise<T> {
  try { return await prisma.$transaction(operacion); } catch (error) { traducirError(error); }
}
export async function tomarEtapa(tx: Tx, datos: { id: string; version: string }) {
  // orden_id es inmutable; esta consulta toma primero el bloqueo de la orden.
  const [fila] = await tx.$queryRaw<{ id: string }[]>`SELECT o.id FROM orden_trabajo o
    JOIN etapa_orden e ON e.orden_id = o.id WHERE e.id = ${datos.id}::uuid FOR UPDATE OF o`;
  if (!fila) throw noEncontrado("etapa");
  const orden = await tx.ordenTrabajo.findUniqueOrThrow({ where: { id: fila.id } });
  exigirOrdenEditable(orden.estado);
  const etapa = await bloquearEtapa(tx, datos.id);
  exigirVersion(etapa, datos.version);
  return { orden, etapa };
}
type EventoEtapa = { etapa: Pick<EtapaGuardada, "id" | "ordenId">; actor: Actor;
  accion: "CREAR" | "CAMBIAR_ESTADO" | "ASIGNAR_RESPONSABLE" | "EDITAR";
  estadoAnterior?: string; estadoNuevo?: string; detalle?: Prisma.InputJsonObject };
export function registrarEtapa(tx: Tx, datos: EventoEtapa) {
  return registrarEvento(tx, { entidad: "ETAPA_ORDEN", entidadId: datos.etapa.id, ordenId: datos.etapa.ordenId,
    actorId: datos.actor.id, accion: datos.accion, estadoAnterior: datos.estadoAnterior,
    estadoNuevo: datos.estadoNuevo, detalle: datos.detalle });
}
