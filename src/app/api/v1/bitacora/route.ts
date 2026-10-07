import { manejar } from "@/lib/http";
import { leerConsulta } from "@/modules/trazabilidad/schema";
import { listarBitacora } from "@/modules/trazabilidad/service";

export const GET = manejar({ permiso: "bitacora:ver" }, async ({ req, actor }) =>
  Response.json(await listarBitacora(leerConsulta(new URL(req.url).searchParams), actor)));
