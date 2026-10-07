import type { z } from "zod";
import { AppError } from "@/lib/errores";

export function leerConsulta<T extends z.ZodType>(parametros: URLSearchParams, esquema: T): z.output<T> {
  const pares = [...parametros.entries()].filter(([, valor]) => valor.trim());
  const lectura = esquema.safeParse(Object.fromEntries(pares));
  if (lectura.success) return lectura.data;
  throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay filtros con errores.",
    campos: Object.fromEntries(lectura.error.issues.map((problema) => [problema.path.join("."), problema.message])) });
}
