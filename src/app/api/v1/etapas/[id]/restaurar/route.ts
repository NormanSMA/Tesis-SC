import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaVersion } from "@/modules/produccion/schema";
import { restaurarEtapa, leerId } from "@/modules/produccion/service";

export const POST = manejar({ permiso: "produccion:planificar" }, async ({ params, req, actor }) =>
  ok(await restaurarEtapa(leerId(params.id), await leerJson(req, esquemaVersion), actor)),
);

