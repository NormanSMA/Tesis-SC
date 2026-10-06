import { notFound } from "next/navigation";

import type { Actor } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";

import { leerIdCliente, obtenerCliente, obtenerFicha } from "./service";
import type { ClienteDto, FichaCliente } from "./tipos";

// Las páginas traducen "no existe" a la pantalla 404 de Next y dejan pasar cualquier otro error.
async function o404<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

export function cargarFicha(id: string, actor: Actor): Promise<FichaCliente> {
  return o404(() => obtenerFicha(leerIdCliente(id), actor));
}

export function cargarCliente(id: string): Promise<ClienteDto> {
  return o404(() => obtenerCliente(leerIdCliente(id)));
}
