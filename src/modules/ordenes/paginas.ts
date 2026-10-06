import { notFound } from "next/navigation";
import type { Actor } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";
import { leerIdCotizacion } from "@/modules/cotizaciones/errores";
import { leerIdOrden, obtenerOrden, proponerOrden } from "./service";

export async function cargarOrden(valor: string, actor: Actor) {
  try { return await obtenerOrden(leerIdOrden(valor), actor); } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

export async function cargarPropuesta(valor: string | string[] | undefined, actor: Actor) {
  try { return await proponerOrden(leerIdCotizacion(valor), actor); } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
