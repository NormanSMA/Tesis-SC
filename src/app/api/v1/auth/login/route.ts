import { cookieSegura, serializarCookieSesion } from "@/lib/auth/cookies";
import { AppError } from "@/lib/errores";
import { leerJson, manejar, ok } from "@/lib/http";
import { ipCliente, ipTruncada } from "@/lib/ip-cliente";
import { exigirCupoLogin, registrarFalloLogin } from "@/lib/limite-tasa";
import { esquemaLogin } from "@/modules/auth/schema";
import { iniciarSesion } from "@/modules/auth/service";

export const POST = manejar({ publica: true }, async ({ req }) => {
  const entrada = await leerJson(req, esquemaLogin);
  const ip = ipCliente(req);
  await exigirCupoLogin(ip);
  let resultado;
  try {
    resultado = await iniciarSesion(entrada, undefined, ipTruncada(ip));
  } catch (error) {
    if (error instanceof AppError && (error.status === 401 || error.status === 423)) {
      await registrarFalloLogin(ip);
    }
    throw error;
  }
  const { token, maxAgeSegundos, ...datos } = resultado;
  const respuesta = ok(datos);
  respuesta.headers.append("Set-Cookie", serializarCookieSesion(token, maxAgeSegundos, cookieSegura(req)));
  return respuesta;
});
