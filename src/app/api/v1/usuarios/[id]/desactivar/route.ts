import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCambiarActivoUsuario } from "@/modules/admin/schema";
import { desactivarUsuario, leerIdUsuario } from "@/modules/admin/service";

export const POST = manejar({ permiso: "usuario:gestionar" }, async ({ req, actor, params }) => {
  const id = leerIdUsuario(params.id);
  return ok(await desactivarUsuario(id, await leerJson(req, esquemaCambiarActivoUsuario), actor));
});
