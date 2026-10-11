import { manejar, ok } from "@/lib/http";
import { leerIdUsuario, reiniciarClaveUsuario } from "@/modules/admin/service";

export const POST = manejar({ permiso: "usuario:gestionar" }, async ({ actor, params }) =>
  ok(await reiniciarClaveUsuario(leerIdUsuario(params.id), actor)),
);
