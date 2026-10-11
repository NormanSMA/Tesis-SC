import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarConfiguracion } from "@/modules/admin/configuracion-schema";
import { editarConfiguracion, listarConfiguracion } from "@/modules/admin/configuracion-service";

export const GET = manejar({ permiso: "configuracion:gestionar" }, async ({ actor }) => {
  return ok(await listarConfiguracion(actor));
});

export const PATCH = manejar({ permiso: "configuracion:gestionar" }, async ({ req, actor }) => {
  const entrada = await leerJson(req, esquemaEditarConfiguracion);
  return ok(await editarConfiguracion(entrada, actor));
});
