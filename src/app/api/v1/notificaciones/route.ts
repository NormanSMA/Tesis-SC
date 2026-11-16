import { manejar, ok } from "@/lib/http";
import { obtenerNotificaciones } from "@/modules/notificaciones/service";

// Sin permiso de ruta: cada fuente de avisos exige el suyo dentro del servicio.
export const GET = manejar({}, async ({ actor }) => ok(await obtenerNotificaciones(actor)));
