import { cookieSegura, leerTokenDeCookies, serializarCookieBorrada } from "@/lib/auth/cookies";
import { manejar, ok } from "@/lib/http";
import { ipCliente, ipTruncada } from "@/lib/ip-cliente";
import { cerrarSesion } from "@/modules/auth/service";

// Idempotente: sin sesión también responde 200 y borra la cookie.
export const POST = manejar({ publica: true }, async ({ req }) => {
  await cerrarSesion(leerTokenDeCookies(req.headers.get("cookie")), undefined, ipTruncada(ipCliente(req)));
  const respuesta = ok({ ok: true });
  respuesta.headers.append("Set-Cookie", serializarCookieBorrada(cookieSegura(req)));
  return respuesta;
});
