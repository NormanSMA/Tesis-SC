import { can, type Actor } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";

export function puedeVerCotizacion(actor: Actor, cotizacion: { creadoPorId: string }) {
  return can(actor, "cotizacion:ver") && (can(actor, "cotizacion:ver_todas") || cotizacion.creadoPorId === actor.id);
}

export function exigirAccesoCotizacion(actor: Actor, cotizacion: { creadoPorId: string }) {
  if (!puedeVerCotizacion(actor, cotizacion)) throw new AppError({
    status: 404, codigo: "NO_ENCONTRADO", mensaje: "La cotización no existe.",
  });
}

export function filtroAutor(actor: Actor) {
  return can(actor, "cotizacion:ver_todas") ? {} : { creadoPorId: actor.id };
}
