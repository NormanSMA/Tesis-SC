import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarMaterial } from "@/modules/inventario/schema";
import { editarMaterial, leerIdMaterial, obtenerMaterial } from "@/modules/inventario/service";

export const GET = manejar({ permiso: "inventario:ver" }, async ({ params, actor }) =>
  ok(await obtenerMaterial(leerIdMaterial(params.id), actor)));
export const PATCH = manejar({ permiso: "material:gestionar" }, async ({ req, params, actor }) =>
  ok(await editarMaterial(leerIdMaterial(params.id), await leerJson(req, esquemaEditarMaterial), actor)));
