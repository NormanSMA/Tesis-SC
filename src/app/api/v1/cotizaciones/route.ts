import { AppError } from "@/lib/errores";
import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaConsultaCotizaciones, esquemaCrearCotizacion, objetoDeParametros } from "@/modules/cotizaciones/schema";
import { crearCotizacion, listarCotizaciones } from "@/modules/cotizaciones/service";

export const GET = manejar({ permiso: "cotizacion:ver" }, async ({ req }) => {
  const consulta = esquemaConsultaCotizaciones.safeParse(objetoDeParametros(new URL(req.url).searchParams));
  if (!consulta.success) {
    const campos = Object.fromEntries(consulta.error.issues.map((problema) => [problema.path.join("."), problema.message]));
    throw new AppError({ codigo: "VALIDACION", mensaje: "Hay parámetros con errores.", status: 422, campos });
  }
  return Response.json(await listarCotizaciones(consulta.data));
});

export const POST = manejar({ permiso: "cotizacion:gestionar" }, async ({ req, actor }) =>
  ok(await crearCotizacion(await leerJson(req, esquemaCrearCotizacion), actor), 201),
);
