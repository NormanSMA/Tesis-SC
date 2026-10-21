import { manejar, ok } from "@/lib/http";
import { purgarSesionesCaducadas } from "@/modules/sistema/service";

export const POST = manejar({ permiso: "configuracion:gestionar" }, async ({ actor }) => {
  return ok(await purgarSesionesCaducadas(actor));
});
