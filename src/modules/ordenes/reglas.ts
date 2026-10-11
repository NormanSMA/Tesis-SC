import type { EstadoOrden } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errores";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { regla } from "./errores";
import type { EntradaEditarOrden } from "./schema";

export const TERMINALES: EstadoOrden[] = ["ENTREGADA", "CERRADA", "CANCELADA"];
export const EDITABLES: EstadoOrden[] = ["PENDIENTE", "EN_PRODUCCION", "LISTA"];

export function estaAtrasada(orden: { estado: EstadoOrden; fechaEntrega: string }, hoy = hoyManagua()): boolean {
  return !TERMINALES.includes(orden.estado) && orden.fechaEntrega < hoy;
}

export function validarFechaEntrega(fecha: string, hoy = hoyManagua()): void {
  if (fecha >= hoy) return;
  throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.",
    campos: { fechaEntrega: "La fecha de entrega no puede ser anterior a hoy." } });
}

export function exigirEditable(estado: EstadoOrden): void {
  if (!EDITABLES.includes(estado)) throw regla("ORDEN_TERMINAL", "Solo puede editar órdenes pendientes, en producción o listas.");
}

export function exigirTransicion(estado: EstadoOrden, accion: "entregar" | "cerrar" | "cancelar"): void {
  const valida = accion === "entregar" ? estado === "LISTA" : accion === "cerrar" ? estado === "ENTREGADA" : EDITABLES.includes(estado);
  if (!valida) throw regla("TRANSICION_INVALIDA", "La acción no está permitida en el estado actual de la orden.");
}

export function validarMotivoCancelacion(motivo: string): string {
  const texto = motivo.trim();
  if (texto.length < 5) throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.",
    campos: { motivo: "Indique un motivo de al menos 5 caracteres." } });
  return texto;
}

type CabeceraEditable = { responsableId: string | null; fechaEntrega: string; especificaciones: string | null };
export function cambiosEdicion(actual: CabeceraEditable, entrada: EntradaEditarOrden) {
  const cambios: Partial<CabeceraEditable> = {};
  if (entrada.responsableId !== undefined && entrada.responsableId !== actual.responsableId) cambios.responsableId = entrada.responsableId;
  if (entrada.fechaEntrega !== undefined && entrada.fechaEntrega !== actual.fechaEntrega) cambios.fechaEntrega = entrada.fechaEntrega;
  if (entrada.especificaciones !== undefined && entrada.especificaciones !== actual.especificaciones) cambios.especificaciones = entrada.especificaciones;
  return cambios;
}
