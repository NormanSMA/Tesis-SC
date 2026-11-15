import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaGuardar } from "@/modules/personalizadas/schema";
import { guardarPersonalizadas, leerPersonalizadas } from "@/modules/personalizadas/service";
export const GET = manejar({ permiso: "cotizacion:gestionar" }, async () => ok(await leerPersonalizadas()));
export const PUT = manejar({ permiso: "tarifa:gestionar" }, async ({ req, actor }) =>
  ok(await guardarPersonalizadas(await leerJson(req, esquemaGuardar), actor)));
