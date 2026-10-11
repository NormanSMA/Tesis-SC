import { manejar, ok } from "@/lib/http";
import { desactivarUsuario, leerIdUsuario } from "@/modules/admin/service";

export const POST = manejar({ permiso: "usuario:gestionar" }, async ({ actor, params }) =>
  ok(await desactivarUsuario(leerIdUsuario(params.id), actor)),
);
