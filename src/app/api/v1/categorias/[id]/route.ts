import { manejar, ok } from "@/lib/http";
import { editarCategoria } from "@/modules/catalogo/categorias";
import { leerEscritura } from "@/modules/catalogo/cuerpo";
import { leerId } from "@/modules/catalogo/errores";
import { esquemaEditarCategoria } from "@/modules/catalogo/schema";

export const PATCH = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor, params }) =>
  ok(await editarCategoria(leerId(params.id), await leerEscritura(req, esquemaEditarCategoria), actor)));
