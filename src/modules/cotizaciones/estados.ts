import { exigir, type Actor } from "@/core/autorizacion";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { totalizarConDescuento } from "./calculo";
import { aCotizacionDto, aItemDto } from "./dto";
import { regla } from "./errores";
import { exigirBorrador, exigirCotizacion, guardarCabecera, registrarCambio, tomarVersion } from "./escritura";
import { hoyManagua, sumarDias } from "./fechas";
import type { FichaGuardada } from "./repo";
import { esquemaResponder, type EntradaResponder } from "./schema";
import type { CotizacionDto } from "./tipos";

export function transicionValidaCotizacion(desde: string | null, hacia: string): boolean {
  if (desde === null) return hacia === "BORRADOR";
  if (desde === "BORRADOR") return hacia === "ENVIADA";
  return desde === "ENVIADA" && ["APROBADA", "RECHAZADA", "VENCIDA", "AJUSTE_SOLICITADO"].includes(hacia);
}

export async function enviarCotizacion(id: string, version: string, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:enviar");
  return prisma.$transaction(async (tx) => {
    const actual = await tomarVersion(tx, id, version);
    if (!transicionValidaCotizacion(actual.estado, "ENVIADA")) throw regla("TRANSICION_INVALIDA", "Solo se puede enviar una cotización en borrador.");
    exigirBorrador(actual);
    if (!actual.items.length) throw regla("SIN_ITEMS", "Agregue al menos un ítem antes de enviar la cotización.");
    const totales = totalizarConDescuento({ items: actual.items.map(aItemDto), descuento: actual.descuento.toFixed(2),
      descuentoPct: actual.descuentoPct?.toFixed(2) ?? null, tasaImpuesto: actual.tasaImpuesto.toFixed(2) });
    const hoy = hoyManagua();
    await guardarCabecera(tx, actual, { ...totales, estado: "ENVIADA", fechaEmision: sumarDias(hoy, 0),
      fechaVencimiento: sumarDias(hoy, actual.vigenciaDias) });
    const nueva = await exigirCotizacion(tx, id);
    await registrarCambio(tx, { ficha: nueva, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: actual.estado,
      estadoNuevo: nueva.estado, detalle: { fechaEmision: hoy, fechaVencimiento: nueva.fechaVencimiento!.toISOString().slice(0, 10) } });
    return aCotizacionDto(nueva);
  });
}

function validarRespuesta(actual: FichaGuardada, entrada: EntradaResponder): void {
  if (!transicionValidaCotizacion(actual.estado, entrada.resultado)) throw regla("TRANSICION_INVALIDA", "Solo se puede responder una cotización enviada.");
  if (actual.archivada) throw regla("COTIZACION_ARCHIVADA", "La cotización está archivada.");
  const vencimiento = actual.fechaVencimiento!.toISOString().slice(0, 10);
  const hoy = hoyManagua();
  if (entrada.resultado === "APROBADA" && hoy > vencimiento) throw regla("VIGENCIA_VENCIDA", "La cotización ya venció. Duplíquela para emitir una nueva.");
  if (entrada.resultado === "VENCIDA" && hoy <= vencimiento) throw regla("VIGENCIA_VIGENTE", "La cotización todavía está dentro de su vigencia.");
  if (entrada.resultado === "RECHAZADA" && !entrada.motivo?.trim()) throw regla("MOTIVO_OBLIGATORIO", "Indique el motivo del rechazo.");
}

export async function responderCotizacion(id: string, entrada: EntradaResponder, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:responder");
  return prisma.$transaction(async (tx) => {
    const actual = await tomarVersion(tx, id, entrada.version);
    validarRespuesta(actual, entrada);
    const validacion = esquemaResponder.safeParse(entrada);
    if (!validacion.success) throw new AppError({ codigo: "VALIDACION", status: 422,
      mensaje: "Hay campos con errores.", campos: Object.fromEntries(validacion.error.issues.map((error) => [error.path.join("."), error.message])) });
    await guardarCabecera(tx, actual, { estado: entrada.resultado, fechaRespuesta: new Date(),
      motivoRechazo: entrada.resultado === "RECHAZADA" ? entrada.motivo!.trim() : null,
      usuarioAprobacionId: entrada.resultado === "APROBADA" ? actor.id : null,
      referenciaAprobacion: entrada.resultado === "APROBADA" ? validacion.data.referenciaAprobacion! : null,
      motivoAjuste: entrada.resultado === "AJUSTE_SOLICITADO" ? validacion.data.motivoAjuste! : null });
    const nueva = await exigirCotizacion(tx, id);
    await registrarCambio(tx, { ficha: nueva, actor, accion: "CAMBIAR_ESTADO", estadoAnterior: actual.estado,
      estadoNuevo: nueva.estado, detalle: { motivo: nueva.motivoRechazo, motivoAjuste: nueva.motivoAjuste,
        referenciaAprobacion: nueva.referenciaAprobacion, usuarioAprobacionId: nueva.usuarioAprobacionId,
        fechaRespuesta: nueva.fechaRespuesta!.toISOString() } });
    return aCotizacionDto(nueva);
  });
}

export async function archivarCotizacion(id: string, version: string, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => {
    const actual = await tomarVersion(tx, id, version);
    if (actual.archivada) throw regla("COTIZACION_ARCHIVADA", "La cotización ya está archivada.");
    await guardarCabecera(tx, actual, { archivada: true });
    const nueva = await exigirCotizacion(tx, id);
    await registrarCambio(tx, { ficha: nueva, actor, accion: "ARCHIVAR", estadoAnterior: actual.estado,
      estadoNuevo: nueva.estado, detalle: { archivada: { anterior: false, nuevo: true } } });
    return aCotizacionDto(nueva);
  });
}
