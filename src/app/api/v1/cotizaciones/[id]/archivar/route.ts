import { manejar, ok } from "@/lib/http";
import { leerVersionCambioEstado } from "@/modules/cotizaciones/cuerpo";
import { archivarCotizacion, leerIdCotizacion } from "@/modules/cotizaciones/service";

export const POST = manejar({ permiso: "cotizacion:gestionar" }, async ({ req, actor, params }) =>
  ok(await archivarCotizacion(leerIdCotizacion(params.id), await leerVersionCambioEstado(req), actor)),
);
