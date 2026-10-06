import { notFound } from "next/navigation";
import type { z } from "zod";
import type { Actor } from "@/core/autorizacion";
import { AppError } from "@/lib/errores";
import { objetoDeParametros } from "./schema";
import { leerIdMaterial, obtenerMaterial } from "./service";

export async function cargarMaterial(valor: string, actor: Actor) {
  try { return await obtenerMaterial(leerIdMaterial(valor), actor); } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
export function consultaPagina<T extends z.ZodType>(parametros: Record<string, string | string[] | undefined>, esquema: T) {
  const resultado = esquema.safeParse(objetoDeParametros(parametros));
  return resultado.success ? { consulta: resultado.data as z.output<T>, error: null }
    : { consulta: esquema.parse({}) as z.output<T>, error: resultado.error.issues.map((problema) => problema.message).join(" ") };
}
