import { manejar, ok } from "@/lib/http";
import { duplicarCotizacion, leerIdCotizacion } from "@/modules/cotizaciones/service";

export const POST = manejar({ permiso: "cotizacion:gestionar" }, async ({ actor, params }) =>
  ok(await duplicarCotizacion(leerIdCotizacion(params.id), actor), 201),
);
