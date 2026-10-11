import { leerTokenDeCookies } from "@/lib/auth/cookies";
import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaCambiarClave } from "@/modules/auth/schema";
import { cambiarClave } from "@/modules/auth/service";

export const POST = manejar({}, async ({ req, actor }) => {
  const entrada = await leerJson(req, esquemaCambiarClave);
  const token = leerTokenDeCookies(req.headers.get("cookie"));
  return ok(await cambiarClave(entrada, actor, token));
});
