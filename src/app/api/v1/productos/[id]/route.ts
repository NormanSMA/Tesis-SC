import { manejar, ok } from "@/lib/http";
import { leerEscritura } from "@/modules/catalogo/cuerpo";
import { esquemaEditarProducto } from "@/modules/catalogo/schema";
import { editarProducto, leerIdProducto, obtenerProducto } from "@/modules/catalogo/service";

export const GET = manejar({ permiso: "catalogo:ver" }, async ({ params }) =>
  ok(await obtenerProducto(leerIdProducto(params.id))));
export const PATCH = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor, params }) =>
  ok(await editarProducto(leerIdProducto(params.id), await leerEscritura(req, esquemaEditarProducto), actor)));
