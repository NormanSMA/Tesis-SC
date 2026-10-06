import { AppError } from "@/lib/errores";
import { leerJson } from "@/lib/http";

import { esquemaCambioEstado } from "./schema";

// Un cuerpo vacío se trata como un cuerpo sin versión: 422 con el campo, no 400 de JSON inválido.
export async function leerVersionCambioEstado(req: Request): Promise<string> {
  const texto = await req.clone().text();
  if (!texto.trim()) {
    const mensaje = "Falta la versión del cliente. Recargue la página.";
    throw new AppError({ codigo: "VALIDACION", mensaje: "Hay campos con errores.", status: 422, campos: { version: mensaje } });
  }
  return (await leerJson(req, esquemaCambioEstado)).version;
}
