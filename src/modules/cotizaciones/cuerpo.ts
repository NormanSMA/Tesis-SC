import type { z } from "zod";
import { AppError } from "@/lib/errores";
import { leerJson } from "@/lib/http";
import { esquemaCambioEstado } from "./schema";

export async function leerCuerpo<T extends z.ZodType>(req: Request, esquema: T): Promise<z.output<T>> {
  const texto = await req.clone().text();
  if (!texto.trim()) {
    throw new AppError({ codigo: "VALIDACION", mensaje: "Hay campos con errores.", status: 422,
      campos: { version: "Falta la versión de la cotización. Recargue los datos." } });
  }
  return leerJson(req, esquema);
}

export async function leerVersionCambioEstado(req: Request): Promise<string> {
  return (await leerCuerpo(req, esquemaCambioEstado)).version;
}
