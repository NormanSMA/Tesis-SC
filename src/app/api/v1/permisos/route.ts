import { manejar, ok } from "@/lib/http";
import { listarPermisos } from "@/modules/admin/permisos-service";

export const GET = manejar({ permiso: "permiso:gestionar" }, async ({ actor }) => {
  return ok(await listarPermisos(actor));
});
