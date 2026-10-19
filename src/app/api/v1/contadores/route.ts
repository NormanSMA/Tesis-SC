import { manejar, ok } from "@/lib/http";
import { obtenerContadores } from "@/modules/navegacion/contadores";

export const GET = manejar({ permiso: "panel:ver" }, async ({ actor }) =>
  ok(await obtenerContadores(actor)),
);
