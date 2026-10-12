import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCambiarActivoUsuario } from "@/modules/admin/schema";
import { leerIdUsuario, reactivarUsuario } from "@/modules/admin/service";

export const POST = manejar({ permiso: "usuario:gestionar" }, async ({ req, actor, params }) => {
  const id = leerIdUsuario(params.id);
  return ok(await reactivarUsuario(id, await leerJson(req, esquemaCambiarActivoUsuario), actor));
});
