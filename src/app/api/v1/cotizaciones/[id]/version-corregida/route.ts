import { manejar, ok } from "@/lib/http";
import { crearVersionCorregida, leerIdCotizacion } from "@/modules/cotizaciones/service";

export const POST = manejar({ permiso: "cotizacion:gestionar" }, async ({ actor, params }) =>
  ok(await crearVersionCorregida(leerIdCotizacion(params.id), actor), 201),
);
