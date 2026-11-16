import "server-only";

import { z } from "zod";
import { AppError } from "@/lib/errores";

export const esquemaDestinoInstalacion = z.object({
  latitud: z.number().min(-90).max(90), longitud: z.number().min(-180).max(180),
});
const respuestaRuta = z.object({ routes: z.array(z.object({ distance: z.number().positive(),
  geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }),
})).min(1) });
let ultimaConsulta = 0;

export async function calcularRuta({ latitud, longitud }: z.infer<typeof esquemaDestinoInstalacion>) {
  const ahora = Date.now();
  if (ahora - ultimaConsulta < 1000) throw new AppError({ codigo: "DEMASIADAS_SOLICITUDES", status: 429,
    mensaje: "Espere un segundo para consultar otra ruta." });
  ultimaConsulta = ahora;
  const origen = "-86.35629,13.09289";
  const destino = `${longitud.toFixed(6)},${latitud.toFixed(6)}`;
  const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origen};${destino}?overview=simplified&geometries=geojson`;
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(7000), cache: "no-store",
      headers: { "User-Agent": "TRACORE Soluciones Creativas (info@s-creativas.net)" } });
    if (respuesta.ok) {
      const ruta = respuestaRuta.safeParse(await respuesta.json());
      if (ruta.success) {
        const { distance, geometry } = ruta.data.routes[0];
        return { km: (distance / 1000).toFixed(3), trazado: geometry.coordinates };
      }
    }
  } catch { /* La captura manual de una distancia verificada sigue disponible. */ }
  throw new AppError({ codigo: "RUTA_NO_DISPONIBLE", status: 422, mensaje: "No se pudo calcular la ruta. Verifique el punto o ingrese los kilómetros manualmente." });
}
