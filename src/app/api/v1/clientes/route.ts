import { leerJson, manejar, ok } from "@/lib/http";
import { AppError } from "@/lib/errores";
import { esquemaConsultaClientes, esquemaCrearCliente, objetoDeParametros } from "@/modules/clientes/schema";
import { crearCliente, listarClientes } from "@/modules/clientes/service";

export const GET = manejar({ permiso: "cliente:ver" }, async ({ req, actor }) => {
  const url = new URL(req.url);
  const consulta = esquemaConsultaClientes.safeParse(objetoDeParametros(url.searchParams));
  if (!consulta.success) {
    const campos = Object.fromEntries(consulta.error.issues.map((problema) => [problema.path.join("."), problema.message]));
    throw new AppError({ codigo: "VALIDACION", mensaje: "Hay parámetros con errores.", status: 422, campos });
  }
  return Response.json(await listarClientes(consulta.data, actor));
});

export const POST = manejar({ permiso: "cliente:gestionar" }, async ({ req, actor }) => {
  const entrada = await leerJson(req, esquemaCrearCliente);
  return ok(await crearCliente(entrada, actor), 201);
});
