import type { AccionBitacora, EntidadBitacora, Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";

export type EventoBitacora = {
  entidad: EntidadBitacora;
  entidadId: string;
  accion: AccionBitacora;
  actorId: string;
  ordenId?: string;
  cotizacionId?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  detalle?: Prisma.InputJsonObject;
  // Solo la siembra fija una fecha pasada. En operación la base asigna la actual.
  creadoEn?: Date;
};

// Los CHECK de la base exigen que el evento de una orden o de una cotización apunte a su propio registro.
function enlaces(evento: EventoBitacora) {
  return {
    ordenId: evento.entidad === "ORDEN_TRABAJO" ? evento.entidadId : evento.ordenId,
    cotizacionId: evento.entidad === "COTIZACION" ? evento.entidadId : evento.cotizacionId,
  };
}

/**
 * Escribe un evento de bitácora dentro de la transacción del cambio.
 * Llámala siempre con el `tx` de la misma transacción: si el evento falla, el cambio se revierte.
 */
export async function registrarEvento(tx: Tx, evento: EventoBitacora): Promise<void> {
  await tx.bitacora.create({
    data: {
      entidad: evento.entidad,
      entidadId: evento.entidadId,
      accion: evento.accion,
      usuarioId: evento.actorId,
      ...enlaces(evento),
      estadoAnterior: evento.estadoAnterior,
      estadoNuevo: evento.estadoNuevo,
      detalle: evento.detalle ?? {},
      creadoEn: evento.creadoEn,
    },
  });
}
