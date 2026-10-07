import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaVersion } from "@/modules/produccion/schema";
import { marcarLista, leerId } from "@/modules/produccion/service";

export const POST = manejar({ permiso: "orden:avanzar" }, async ({ params, req, actor }) =>
  ok(await marcarLista(leerId(params.id), await leerJson(req, esquemaVersion), actor)),
);

