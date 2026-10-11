import { notFound } from "next/navigation";

import type { Actor } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";

import { leerIdProducto, obtenerProducto } from "./service";

export async function cargarProducto(id: string, actor: Actor) {
  try { return await obtenerProducto(leerIdProducto(id), actor); }
  catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
