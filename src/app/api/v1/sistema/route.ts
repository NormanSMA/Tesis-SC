import { manejar, ok } from "@/lib/http";
import { obtenerEstadoSistema } from "@/modules/sistema/service";

export const GET = manejar({ permiso: "configuracion:gestionar" }, async ({ actor }) => {
  return ok(await obtenerEstadoSistema(actor));
});
