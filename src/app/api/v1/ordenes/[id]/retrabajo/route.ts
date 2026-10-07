import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaRetrabajo } from "@/modules/produccion/schema";
import { reabrirPorRetrabajo, leerId } from "@/modules/produccion/service";

export const POST = manejar({ permiso: "orden:avanzar" }, async ({ params, req, actor }) =>
  ok(await reabrirPorRetrabajo(leerId(params.id), await leerJson(req, esquemaRetrabajo), actor)),
);

