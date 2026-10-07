import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaOmitirEtapa } from "@/modules/produccion/schema";
import { omitirEtapa, leerId } from "@/modules/produccion/service";

export const POST = manejar({ permiso: "produccion:planificar" }, async ({ params, req, actor }) =>
  ok(await omitirEtapa(leerId(params.id), await leerJson(req, esquemaOmitirEtapa), actor)),
);

