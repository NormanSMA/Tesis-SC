import { manejar, ok } from "@/lib/http";
import { leerCuerpo } from "@/modules/cotizaciones/cuerpo";
import { esquemaEditarCotizacion } from "@/modules/cotizaciones/schema";
import { editarCotizacion, leerIdCotizacion, obtenerCotizacion } from "@/modules/cotizaciones/service";

export const GET = manejar({ permiso: "cotizacion:ver" }, async ({ params }) =>
  ok(await obtenerCotizacion(leerIdCotizacion(params.id))),
);
export const PATCH = manejar({ permiso: "cotizacion:gestionar" }, async ({ req, actor, params }) =>
  ok(await editarCotizacion(leerIdCotizacion(params.id), await leerCuerpo(req, esquemaEditarCotizacion), actor)),
);
