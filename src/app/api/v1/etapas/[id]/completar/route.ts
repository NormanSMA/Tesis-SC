import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaVersion } from "@/modules/produccion/schema";
import { completarEtapa, leerId } from "@/modules/produccion/service";

export const POST = manejar({ permiso: "produccion:ejecutar" }, async ({ params, req, actor }) =>
  ok(await completarEtapa(leerId(params.id), await leerJson(req, esquemaVersion), actor)),
);

