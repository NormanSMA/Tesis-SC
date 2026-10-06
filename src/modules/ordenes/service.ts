import { can, exigir, type Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { aOrdenDto, aOrdenFila } from "./dto";
import { exigirOrden, guardarCambios, leerVersion, registrarCambio, transaccionOrden, validarResponsable } from "./escritura";
import { cambiosEdicion, exigirEditable, validarFechaEntrega } from "./reglas";
import { consultarOpciones, consultarOrdenes } from "./repo";
import type { ConsultaOrdenes, EntradaEditarOrden } from "./schema";
import type { ListaOrdenes, OpcionesOrden } from "./tipos";

export { leerIdOrden } from "./errores";
export { crearOrden, ordenDeCotizacion, proponerOrden } from "./conversion";
export { entregarOrden, cerrarOrden, cancelarOrden } from "./estados";

export async function obtenerOrden(id: string, actor: Actor) {
  exigir(actor, "orden:ver");
  return aOrdenDto(await exigirOrden(prisma, id), actor);
}

export async function listarOrdenes(consulta: ConsultaOrdenes, actor: Actor): Promise<ListaOrdenes> {
  exigir(actor, "orden:ver");
  const { filas, total } = await consultarOrdenes(consulta);
  return { datos: filas.map((fila) => aOrdenFila(fila, actor)), total, pagina: consulta.pagina, porPagina: consulta.porPagina };
}

export async function opcionesOrden(actor: Actor): Promise<OpcionesOrden> {
  if (!can(actor, "orden:crear")) exigir(actor, "orden:gestionar");
  return consultarOpciones();
}

export async function editarOrden(id: string, entrada: EntradaEditarOrden, actor: Actor) {
  exigir(actor, "orden:gestionar");
  return transaccionOrden(async (tx) => {
    // El bloqueo permite confirmar un PATCH sin cambios sin adelantar su versión.
    await tx.$queryRaw`SELECT id FROM orden_trabajo WHERE id = ${id}::uuid FOR UPDATE`;
    const actual = await leerVersion(tx, id, entrada.version);
    exigirEditable(actual.estado);
    const cambios = cambiosEdicion({ responsableId: actual.responsableId, especificaciones: actual.especificaciones,
      fechaEntrega: actual.fechaEntrega.toISOString().slice(0, 10) }, entrada);
    if (!Object.keys(cambios).length) return aOrdenDto(actual, actor);
    if (cambios.fechaEntrega) validarFechaEntrega(cambios.fechaEntrega);
    if (cambios.responsableId) await validarResponsable(tx, cambios.responsableId);
    await guardarCambios(tx, actual, { ...cambios, fechaEntrega: cambios.fechaEntrega ? new Date(cambios.fechaEntrega) : undefined });
    if (cambios.responsableId) await registrarCambio(tx, { ordenId: id, actor, accion: "ASIGNAR_RESPONSABLE",
      detalle: { responsableId: { anterior: actual.responsableId, nuevo: cambios.responsableId } } });
    const detalle: Record<string, Prisma.InputJsonValue> = {};
    if (cambios.fechaEntrega) detalle.fechaEntrega = { anterior: actual.fechaEntrega.toISOString().slice(0, 10), nuevo: cambios.fechaEntrega };
    if (cambios.especificaciones !== undefined) detalle.especificaciones = { anterior: actual.especificaciones, nuevo: cambios.especificaciones };
    if (Object.keys(detalle).length) await registrarCambio(tx, { ordenId: id, actor, accion: "EDITAR", detalle });
    return aOrdenDto(await exigirOrden(tx, id), actor);
  });
}
