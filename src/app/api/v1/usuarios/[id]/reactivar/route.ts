import { manejar, ok } from "@/lib/http";
import { leerIdUsuario, reactivarUsuario } from "@/modules/admin/service";

export const POST = manejar({ permiso: "usuario:gestionar" }, async ({ actor, params }) =>
  ok(await reactivarUsuario(leerIdUsuario(params.id), actor)),
);
