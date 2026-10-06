import { manejar, ok } from "@/lib/http";
import { leerCuerpo } from "@/modules/cotizaciones/cuerpo";
import { esquemaResponder } from "@/modules/cotizaciones/schema";
import { leerIdCotizacion, responderCotizacion } from "@/modules/cotizaciones/service";

export const POST = manejar({ permiso: "cotizacion:responder" }, async ({ req, actor, params }) =>
  ok(await responderCotizacion(leerIdCotizacion(params.id), await leerCuerpo(req, esquemaResponder), actor)),
);
