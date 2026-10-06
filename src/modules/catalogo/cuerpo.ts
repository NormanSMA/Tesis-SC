import type { z } from "zod";

import { AppError } from "@/lib/errores";
import { leerJson } from "@/lib/http";

import { MENSAJE_VERSION, objetoDeParametros } from "./schema";

export async function leerEscritura<T extends z.ZodType>(req: Request, esquema: T): Promise<z.output<T>> {
  if (!(await req.clone().text()).trim()) throw new AppError({ codigo: "VALIDACION", status: 422,
    mensaje: "Hay campos con errores.", campos: { version: MENSAJE_VERSION } });
  return leerJson(req, esquema);
}
export function leerConsulta<T extends z.ZodType>(parametros: URLSearchParams, esquema: T): z.output<T> {
  const resultado = esquema.safeParse(objetoDeParametros(parametros));
  if (resultado.success) return resultado.data;
  const campos = Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join("."), problema.message]));
  throw new AppError({ codigo: "VALIDACION", mensaje: "Hay parámetros con errores.", status: 422, campos });
}
