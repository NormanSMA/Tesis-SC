import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaVersion } from "@/modules/produccion/schema";
import { archivarPlantilla, leerId } from "@/modules/produccion/service";

export const POST = manejar({ permiso: "catalogo:gestionar" }, async ({ params, req, actor }) =>
  ok(await archivarPlantilla(leerId(params.id), await leerJson(req, esquemaVersion), actor)),
);

