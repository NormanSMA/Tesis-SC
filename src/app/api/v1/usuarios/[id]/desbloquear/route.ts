import { manejar, ok } from "@/lib/http";
import { desbloquearUsuario, leerIdUsuario } from "@/modules/admin/service";

export const POST = manejar({ permiso: "usuario:gestionar" }, async ({ actor, params }) =>
  ok(await desbloquearUsuario(leerIdUsuario(params.id), actor)),
);
