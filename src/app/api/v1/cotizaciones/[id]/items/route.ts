import { manejar, ok } from "@/lib/http";
import { leerCuerpo } from "@/modules/cotizaciones/cuerpo";
import { esquemaReemplazarItems } from "@/modules/cotizaciones/schema";
import { leerIdCotizacion, reemplazarItems } from "@/modules/cotizaciones/service";

export const PUT = manejar({ permiso: "cotizacion:gestionar" }, async ({ req, actor, params }) =>
  ok(await reemplazarItems(leerIdCotizacion(params.id), await leerCuerpo(req, esquemaReemplazarItems), actor)),
);
