import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaReemplazarPermisos } from "@/modules/admin/permisos-schema";
import { leerPerfilPermisos, reemplazarPermisosPerfil } from "@/modules/admin/permisos-service";

export const PUT = manejar({ permiso: "permiso:gestionar" }, async ({ req, actor, params }) => {
  const perfil = leerPerfilPermisos(params.perfil);
  const entrada = await leerJson(req, esquemaReemplazarPermisos);
  return ok(await reemplazarPermisosPerfil(perfil, entrada, actor));
});
