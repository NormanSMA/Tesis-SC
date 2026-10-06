import { manejar, ok } from "@/lib/http";
import { opcionesOrden } from "@/modules/ordenes/service";

export const GET = manejar({}, async ({ actor }) => ok(await opcionesOrden(actor)));
