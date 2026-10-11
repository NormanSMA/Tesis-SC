import { AppError } from "@/lib/errores";
import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaConsultaUsuarios, esquemaCrearUsuario } from "@/modules/admin/schema";
import { crearUsuario, listarUsuarios } from "@/modules/admin/service";

export const GET = manejar({ permiso: "usuario:gestionar" }, async ({ req, actor }) => {
  const parametros = [...new URL(req.url).searchParams].map(([clave, valor]) => [clave, valor.trim()]);
  const consulta = esquemaConsultaUsuarios.safeParse(Object.fromEntries(parametros.filter(([, valor]) => valor)));
  if (!consulta.success) {
    const campos = Object.fromEntries(consulta.error.issues.map((problema) => [problema.path.join("."), problema.message]));
    throw new AppError({ codigo: "VALIDACION", mensaje: "Hay parámetros con errores.", status: 422, campos });
  }
  return Response.json(await listarUsuarios(consulta.data, actor));
});

export const POST = manejar({ permiso: "usuario:gestionar" }, async ({ req, actor }) => {
  return ok(await crearUsuario(await leerJson(req, esquemaCrearUsuario), actor), 201);
});
