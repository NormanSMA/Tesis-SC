import { manejar, ok } from "@/lib/http";
import { marcarLeidas } from "@/modules/notificaciones/service";

// Marca como leídos los avisos propios; no modifica datos de negocio.
export const POST = manejar({}, async ({ actor }) => ok(await marcarLeidas(actor)));
