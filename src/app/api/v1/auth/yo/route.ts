import { manejar, ok } from "@/lib/http";
import { respuestaSesion } from "@/modules/auth/service";

export const GET = manejar({}, ({ actor }) => ok(respuestaSesion(actor)));
