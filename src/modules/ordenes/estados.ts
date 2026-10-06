import { exigir, type Actor } from "@/core/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import type { Tx } from "@/lib/db";
import { aOrdenDto } from "./dto";
import { exigirOrden, guardarCambios, leerVersion, registrarCambio, transaccionOrden } from "./escritura";
import { exigirTransicion, validarMotivoCancelacion } from "./reglas";
import type { EntradaCancelarOrden } from "./schema";

export async function entregarOrden(id: string, version: string, actor: Actor) {
  exigir(actor, "orden:entregar");
  return transaccionOrden(async (tx) => {
    const actual = await leerVersion(tx, id, version);
    exigirTransicion(actual.estado, "entregar");
    await guardarCambios(tx, actual, { estado: "ENTREGADA", fechaEntregaReal: new Date() });
    await registrarCambio(tx, { ordenId: id, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: actual.estado,
      estadoNuevo: "ENTREGADA" });
    return aOrdenDto(await exigirOrden(tx, id), actor);
  });
}

export async function cerrarOrden(id: string, version: string, actor: Actor) {
  exigir(actor, "orden:cerrar");
  return transaccionOrden(async (tx) => {
    const actual = await leerVersion(tx, id, version);
    exigirTransicion(actual.estado, "cerrar");
    await guardarCambios(tx, actual, { estado: "CERRADA", fechaCierre: new Date() });
    await registrarCambio(tx, { ordenId: id, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: actual.estado,
      estadoNuevo: "CERRADA" });
    return aOrdenDto(await exigirOrden(tx, id), actor);
  });
}

async function omitirEtapas(tx: Tx, datos: { ordenId: string; motivo: string; actor: Actor }): Promise<void> {
  const pendientes = await tx.etapaOrden.findMany({ where: { ordenId: datos.ordenId, estado: "PENDIENTE" }, orderBy: { secuencia: "asc" } });
  for (const etapa of pendientes) {
    await tx.etapaOrden.update({ where: { id: etapa.id }, data: { estado: "OMITIDA", observaciones: datos.motivo } });
    await registrarEvento(tx, { entidad: "ETAPA_ORDEN", entidadId: etapa.id, ordenId: datos.ordenId,
      actorId: datos.actor.id, accion: "CAMBIAR_ESTADO", estadoAnterior: "PENDIENTE", estadoNuevo: "OMITIDA",
      detalle: { motivo: datos.motivo, nombre: etapa.nombre } });
  }
}

export async function cancelarOrden(id: string, entrada: EntradaCancelarOrden, actor: Actor) {
  exigir(actor, "orden:cancelar");
  const motivo = validarMotivoCancelacion(entrada.motivo);
  return transaccionOrden(async (tx) => {
    const actual = await leerVersion(tx, id, entrada.version);
    exigirTransicion(actual.estado, "cancelar");
    await guardarCambios(tx, actual, { estado: "CANCELADA", motivoCancelacion: motivo });
    await registrarCambio(tx, { ordenId: id, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: actual.estado,
      estadoNuevo: "CANCELADA", detalle: { motivo } });
    await omitirEtapas(tx, { ordenId: id, motivo, actor });
    return aOrdenDto(await exigirOrden(tx, id), actor);
  });
}
