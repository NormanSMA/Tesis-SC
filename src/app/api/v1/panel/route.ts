import { manejar, ok } from "@/lib/http";
import { obtenerPanel } from "@/modules/panel/service";

export const GET = manejar({ permiso: "panel:ver" }, async ({ actor, req }) =>
  ok(await obtenerPanel(actor, new Date(), new URL(req.url).searchParams.get("perfil"))));
