import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCrearPlantilla } from "@/modules/produccion/schema";
import { listarPlantillas, crearPlantilla, leerId } from "@/modules/produccion/service";

export const GET = manejar({ permiso: "produccion:ver" }, async ({ params, actor }) =>
  ok(await listarPlantillas(leerId(params.id), actor)),
);

export const POST = manejar({ permiso: "catalogo:gestionar" }, async ({ params, req, actor }) =>
  ok(await crearPlantilla(leerId(params.id), await leerJson(req, esquemaCrearPlantilla), actor), 201),
);

