import { manejar, ok } from "@/lib/http";
import { leerEscritura } from "@/modules/catalogo/cuerpo";
import { esquemaCambioEstado } from "@/modules/catalogo/schema";
import { archivarProducto, leerIdProducto } from "@/modules/catalogo/service";

export const POST = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor, params }) =>
  ok(await archivarProducto(leerIdProducto(params.id), (await leerEscritura(req, esquemaCambioEstado)).version, actor)));
