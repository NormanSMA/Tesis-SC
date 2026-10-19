import { can, exigir, type Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { aOrdenDto, aOrdenFila } from "./dto";
import { exigirOrden, guardarCambios, leerVersion, registrarCambio, transaccionOrden, validarResponsable } from "./escritura";
import { cambiosEdicion, exigirEditable, validarFechaEntrega } from "./reglas";
import { consultarConteosOrdenes, consultarOpciones, consultarOrdenes } from "./repo";
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
  const hoy = hoyManagua();
  const [{ filas, total, avances }, conteos] = await Promise.all([
    consultarOrdenes(consulta, hoy), consultarConteosOrdenes(consulta, hoy),
  ]);
  return { datos: filas.map((fila) => ({ ...aOrdenFila(fila, actor), avance: avances.get(fila.id) ?? { completadas: 0, total: 0 } })),
    total, pagina: consulta.pagina, porPagina: consulta.porPagina, conteos };
}

export async function opcionesOrden(actor: Actor): Promise<OpcionesOrden> {
  if (!can(actor, "orden:crear") && !can(actor, "orden:gestionar")) exigir(actor, "produccion:planificar");
  return consultarOpciones();
}

export async function editarOrden(id: string, entrada: EntradaEditarOrden, actor: Actor) {
  if (!can(actor, "orden:gestionar")) {
    exigir(actor, "produccion:planificar");
    if (entrada.fechaEntrega !== undefined || entrada.especificaciones !== undefined) exigir(actor, "orden:gestionar");
  }
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
    if (cambios.responsableId !== undefined) await registrarCambio(tx, { ordenId: id, actor, accion: "ASIGNAR_RESPONSABLE",
      detalle: { responsableId: { anterior: actual.responsableId, nuevo: cambios.responsableId } } });
    const detalle: Record<string, Prisma.InputJsonValue> = {};
    if (cambios.fechaEntrega) detalle.fechaEntrega = { anterior: actual.fechaEntrega.toISOString().slice(0, 10), nuevo: cambios.fechaEntrega };
    if (cambios.especificaciones !== undefined) detalle.especificaciones = { anterior: actual.especificaciones, nuevo: cambios.especificaciones };
    if (Object.keys(detalle).length) await registrarCambio(tx, { ordenId: id, actor, accion: "EDITAR", detalle });
    return aOrdenDto(await exigirOrden(tx, id), actor);
  });
}
