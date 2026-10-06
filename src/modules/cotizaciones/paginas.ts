import { notFound } from "next/navigation";
import { AppError } from "@/lib/errores";
import { leerIdCotizacion, obtenerCotizacion } from "./service";

export async function cargarCotizacion(valor: string) {
  try {
    return await obtenerCotizacion(leerIdCotizacion(valor));
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
