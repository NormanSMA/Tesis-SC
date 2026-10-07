import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarPlantilla } from "@/modules/produccion/schema";
import { editarPlantilla, leerId } from "@/modules/produccion/service";

export const PATCH = manejar({ permiso: "catalogo:gestionar" }, async ({ params, req, actor }) =>
  ok(await editarPlantilla(leerId(params.id), await leerJson(req, esquemaEditarPlantilla), actor)),
);

