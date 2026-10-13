import { leerEntorno } from "@/env";
import { viaProxy } from "@/lib/ip-cliente";

const TTL_POR_DEFECTO_HORAS = 12;

export function nombreCookieSesion(): string {
  return leerEntorno().SESSION_COOKIE_NAME || "sc_sesion";
}

export function ttlSesionHoras(): number {
  const horas = Number(leerEntorno().SESSION_TTL_HOURS);
  return Number.isFinite(horas) && horas > 0 ? horas : TTL_POR_DEFECTO_HORAS;
}

export function cookieSegura(req: Request): boolean {
  return leerEntorno().SESSION_COOKIE_SECURE === "true" ||
    (viaProxy(req) && req.headers.get("x-forwarded-proto") === "https");
}

function atributosFijos(segura: boolean): string {
  const secure = segura ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function serializarCookieSesion(token: string, maxAgeSegundos: number, segura: boolean): string {
  return `${nombreCookieSesion()}=${token}; ${atributosFijos(segura)}; Max-Age=${Math.floor(maxAgeSegundos)}`;
}

export function serializarCookieBorrada(segura: boolean): string {
  return `${nombreCookieSesion()}=; ${atributosFijos(segura)}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function leerTokenDeCookies(encabezadoCookie: string | null): string | null {
  if (!encabezadoCookie) return null;
  const nombre = nombreCookieSesion();
  for (const par of encabezadoCookie.split(";")) {
    const indice = par.indexOf("=");
    if (indice > 0 && par.slice(0, indice).trim() === nombre) {
      return par.slice(indice + 1).trim() || null;
    }
  }
  return null;
}
