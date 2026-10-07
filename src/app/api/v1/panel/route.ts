import { manejar, ok } from "@/lib/http";
import { obtenerPanel } from "@/modules/panel/service";

export const GET = manejar({ permiso: "panel:ver" }, async ({ actor }) => ok(await obtenerPanel(actor)));
