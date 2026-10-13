import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { leerEntorno } from "@/env";
import { AppError } from "@/lib/errores";

type PoliticaLimite = { puntos: number; duracion: number };
type ConfiguracionLimites = Record<"lectura" | "escritura" | "publica" | "loginFallo", PoliticaLimite>;
type EstadoLimites = {
  configuracion: ConfiguracionLimites;
  lectura: RateLimiterMemory;
  escritura: RateLimiterMemory;
  publica: RateLimiterMemory;
  loginFallo: RateLimiterMemory;
};

const globales = globalThis as unknown as { limitesTasa?: EstadoLimites };
const METODOS_LECTURA = new Set(["GET", "HEAD"]);
const METODOS_ESCRITURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function configuracionPredeterminada(): ConfiguracionLimites {
  const entorno = leerEntorno();
  return {
    lectura: { puntos: entorno.LIMITE_LECTURA ?? 6000, duracion: 60 },
    escritura: { puntos: entorno.LIMITE_ESCRITURA ?? 1200, duracion: 60 },
    publica: { puntos: entorno.LIMITE_PUBLICA ?? 120, duracion: 60 },
    loginFallo: { puntos: entorno.LIMITE_LOGIN_FALLOS ?? 30, duracion: 900 },
  };
}

function crearLimites(configuracion: ConfiguracionLimites): EstadoLimites {
  const crear = (politica: PoliticaLimite, keyPrefix: string, bloqueo = false) => new RateLimiterMemory({
    points: politica.puntos,
    duration: politica.duracion,
    keyPrefix,
    blockDuration: bloqueo ? politica.duracion : 0,
  });
  return {
    configuracion,
    lectura: crear(configuracion.lectura, "usuario:lectura"),
    escritura: crear(configuracion.escritura, "usuario:escritura"),
    publica: crear(configuracion.publica, "ip:publica"),
    loginFallo: crear(configuracion.loginFallo, "ip:login-fallo", true),
  };
}

function obtenerLimites(): EstadoLimites {
  return globales.limitesTasa ??= crearLimites(configuracionPredeterminada());
}

function demasiadasSolicitudes(resultado: RateLimiterRes): AppError {
  const reintentarEnSegundos = Math.max(1, Math.ceil(resultado.msBeforeNext / 1000));
  return new AppError({
    status: 429,
    codigo: "DEMASIADAS_SOLICITUDES",
    mensaje: `Demasiadas solicitudes. Intente de nuevo en ${reintentarEnSegundos} segundos.`,
    reintentarEnSegundos,
  });
}

async function consumir(limite: RateLimiterMemory, clave: string): Promise<RateLimiterRes> {
  try {
    return await limite.consume(clave);
  } catch (error) {
    if (error instanceof RateLimiterRes) throw demasiadasSolicitudes(error);
    throw error;
  }
}

export async function limitarPorIp(ip: string): Promise<void> {
  await consumir(obtenerLimites().publica, ip);
}

export async function limitarPorUsuario(actorId: string, metodo: string): Promise<void> {
  if (METODOS_LECTURA.has(metodo)) await consumir(obtenerLimites().lectura, actorId);
  else if (METODOS_ESCRITURA.has(metodo)) await consumir(obtenerLimites().escritura, actorId);
}

export async function registrarFalloLogin(ip: string): Promise<void> {
  const limitarFallosLogin = obtenerLimites().loginFallo;
  const resultado = await consumir(limitarFallosLogin, ip);
  // La comprobación previa evita exceder puntos: inicia el bloqueo al agotar el cupo.
  if (resultado.remainingPoints === 0) await limitarFallosLogin.block(ip, limitarFallosLogin.blockDuration);
}

export async function exigirCupoLogin(ip: string): Promise<void> {
  const limitarFallosLogin = obtenerLimites().loginFallo;
  const resultado = await limitarFallosLogin.get(ip);
  if (resultado && resultado.remainingPoints <= 0) throw demasiadasSolicitudes(resultado);
}

export function configurarLimites(parcial: Partial<ConfiguracionLimites>): void {
  globales.limitesTasa = crearLimites({ ...obtenerLimites().configuracion, ...parcial });
}

export function reiniciarLimites(): void {
  globales.limitesTasa = crearLimites(configuracionPredeterminada());
}
