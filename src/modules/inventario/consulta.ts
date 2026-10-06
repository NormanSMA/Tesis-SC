import type { z } from "zod";
import { AppError } from "@/lib/errores";
import { objetoDeParametros } from "./schema";

export function leerConsulta<T extends z.ZodType>(req: Request, esquema: T): z.output<T> {
  const resultado = esquema.safeParse(objetoDeParametros(new URL(req.url).searchParams));
  if (resultado.success) return resultado.data;
  throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay parámetros con errores.",
    campos: Object.fromEntries(resultado.error.issues.map((problema) => [problema.path.join("."), problema.message])) });
}
