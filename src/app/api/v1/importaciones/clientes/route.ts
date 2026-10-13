import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaImportacion } from "@/modules/importacion/schema";
import { importarClientes, validarClientes } from "@/modules/importacion/service";

export const POST = manejar({ permiso: "cliente:gestionar" }, async ({ req, actor }) => {
  const { texto, confirmar } = await leerJson(req, esquemaImportacion);
  return ok(await (confirmar ? importarClientes(texto, actor) : validarClientes(texto, actor)));
});
