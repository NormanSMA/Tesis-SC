import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaEditarUsuario } from "@/modules/admin/schema";
import { editarUsuario, leerIdUsuario, obtenerUsuario } from "@/modules/admin/service";

export const GET = manejar({ permiso: "usuario:gestionar" }, async ({ actor, params }) =>
  ok(await obtenerUsuario(leerIdUsuario(params.id), actor)),
);

export const PATCH = manejar({ permiso: "usuario:gestionar" }, async ({ req, actor, params }) => {
  const id = leerIdUsuario(params.id);
  return ok(await editarUsuario(id, await leerJson(req, esquemaEditarUsuario), actor));
});
