import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCrearArea } from "@/modules/produccion/schema";
import { listarAreas, crearArea } from "@/modules/produccion/service";

export const GET = manejar({ permiso: "produccion:ver" }, async ({ actor }) =>
  ok(await listarAreas(actor)),
);

export const POST = manejar({ permiso: "catalogo:gestionar" }, async ({ req, actor }) =>
  ok(await crearArea(await leerJson(req, esquemaCrearArea), actor), 201),
);

