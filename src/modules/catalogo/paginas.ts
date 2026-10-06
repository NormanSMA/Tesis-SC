import { notFound } from "next/navigation";

import { AppError } from "@/lib/errores";

import { leerIdProducto, obtenerProducto } from "./service";

export async function cargarProducto(id: string) {
  try { return await obtenerProducto(leerIdProducto(id)); }
  catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
