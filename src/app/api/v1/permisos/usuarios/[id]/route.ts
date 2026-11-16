import { z } from "zod";
import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaReemplazarPermisos } from "@/modules/admin/permisos-schema";
import { guardarAccesosIndividuales } from "@/modules/admin/permisos-usuario";

export const PUT = manejar({ permiso: "permiso:gestionar" }, async ({ req, actor, params }) =>
  ok(await guardarAccesosIndividuales(z.uuid().parse(params.id), await leerJson(req, esquemaReemplazarPermisos), actor)));
