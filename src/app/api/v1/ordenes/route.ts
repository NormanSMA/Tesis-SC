import { AppError } from "@/lib/errores";
import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaConsultaOrdenes, esquemaCrearOrden, objetoDeParametros } from "@/modules/ordenes/schema";
import { crearOrden, listarOrdenes } from "@/modules/ordenes/service";

export const GET = manejar({ permiso: "orden:ver" }, async ({ req, actor }) => {
  const consulta = esquemaConsultaOrdenes.safeParse(objetoDeParametros(new URL(req.url).searchParams));
  if (!consulta.success) {
    const campos = Object.fromEntries(consulta.error.issues.map((problema) => [problema.path.join("."), problema.message]));
    throw new AppError({ codigo: "VALIDACION", mensaje: "Hay parámetros con errores.", status: 422, campos });
  }
  return Response.json(await listarOrdenes(consulta.data, actor));
});

export const POST = manejar({ permiso: "orden:crear" }, async ({ req, actor }) =>
  ok(await crearOrden(await leerJson(req, esquemaCrearOrden), actor), 201),
);
