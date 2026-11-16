import { leerJson, manejar, ok } from "@/lib/http";
import { calcularRuta, esquemaDestinoInstalacion } from "@/modules/cotizaciones/ruta-instalacion";

export const POST = manejar({ permiso: "cotizacion:gestionar" }, async ({ req }) =>
  ok(await calcularRuta(await leerJson(req, esquemaDestinoInstalacion))));
