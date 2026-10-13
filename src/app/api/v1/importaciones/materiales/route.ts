import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaImportacion } from "@/modules/importacion/schema";
import { importarMateriales, validarMateriales } from "@/modules/importacion/service";

export const POST = manejar({ permiso: "material:gestionar" }, async ({ req, actor }) => {
  const { texto, confirmar } = await leerJson(req, esquemaImportacion);
  return ok(await (confirmar ? importarMateriales(texto, actor) : validarMateriales(texto, actor)));
});
