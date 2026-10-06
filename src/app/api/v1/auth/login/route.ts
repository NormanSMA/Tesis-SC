import { serializarCookieSesion } from "@/lib/auth/cookies";
import { leerJson, manejar, ok } from "@/lib/http";
import { esquemaLogin } from "@/modules/auth/schema";
import { iniciarSesion } from "@/modules/auth/service";

export const POST = manejar({ publica: true }, async ({ req }) => {
  const { token, maxAgeSegundos, ...datos } = await iniciarSesion(await leerJson(req, esquemaLogin));
  const respuesta = ok(datos);
  respuesta.headers.append("Set-Cookie", serializarCookieSesion(token, maxAgeSegundos));
  return respuesta;
});
