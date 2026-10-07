import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarArea } from "@/modules/produccion/schema";
import { editarArea, leerId } from "@/modules/produccion/service";

export const PATCH = manejar({ permiso: "catalogo:gestionar" }, async ({ params, req, actor }) =>
  ok(await editarArea(leerId(params.id), await leerJson(req, esquemaEditarArea), actor)),
);

