import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarEtapa } from "@/modules/produccion/schema";
import { editarEtapa, leerId } from "@/modules/produccion/service";

export const PATCH = manejar({ permiso: "produccion:planificar" }, async ({ params, req, actor }) =>
  ok(await editarEtapa(leerId(params.id), await leerJson(req, esquemaEditarEtapa), actor)),
);

