import { manejar } from "@/lib/http";
import { esquemaTablero } from "@/modules/produccion/schema";
import { obtenerTablero } from "@/modules/produccion/service";
import { leerConsulta } from "@/modules/produccion/api";

export const GET = manejar({ permiso: "produccion:ver" }, async ({ req, actor }) =>
  Response.json(await obtenerTablero(leerConsulta(new URL(req.url).searchParams, esquemaTablero), actor)),
);
