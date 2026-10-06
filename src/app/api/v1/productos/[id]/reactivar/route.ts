import { manejar, ok } from "@/lib/http";
import { leerEscritura } from "@/modules/catalogo/cuerpo";
import { esquemaCambioEstado } from "@/modules/catalogo/schema";
import { leerIdProducto, reactivarProducto } from "@/modules/catalogo/service";

export const POST = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor, params }) =>
  ok(await reactivarProducto(leerIdProducto(params.id), (await leerEscritura(req, esquemaCambioEstado)).version, actor)));
