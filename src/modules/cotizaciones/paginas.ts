import type { Actor } from "@/core/autorizacion";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errores";
import { leerIdCotizacion, obtenerCotizacion } from "./service";

export async function cargarCotizacion(valor: string, actor: Actor) {
  try {
    return await obtenerCotizacion(leerIdCotizacion(valor), actor);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
