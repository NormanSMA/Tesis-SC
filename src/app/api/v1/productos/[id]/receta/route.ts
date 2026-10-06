import { manejar, ok } from "@/lib/http";
import { leerEscritura } from "@/modules/catalogo/cuerpo";
import { leerId } from "@/modules/catalogo/errores";
import { reemplazarReceta } from "@/modules/catalogo/recetas";
import { esquemaReceta } from "@/modules/catalogo/schema";

export const PUT = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor, params }) =>
  ok(await reemplazarReceta(leerId(params.id), await leerEscritura(req, esquemaReceta), actor)));
