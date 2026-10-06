import { manejar, ok } from "@/lib/http";
import { leerVersionCambioEstado } from "@/modules/cotizaciones/cuerpo";
import { enviarCotizacion, leerIdCotizacion } from "@/modules/cotizaciones/service";

export const POST = manejar({ permiso: "cotizacion:enviar" }, async ({ req, actor, params }) =>
  ok(await enviarCotizacion(leerIdCotizacion(params.id), await leerVersionCambioEstado(req), actor)),
);
