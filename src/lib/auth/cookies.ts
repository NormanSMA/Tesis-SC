const TTL_POR_DEFECTO_HORAS = 12;

export function nombreCookieSesion(): string {
  return process.env.SESSION_COOKIE_NAME || "sc_sesion";
}

export function ttlSesionHoras(): number {
  const horas = Number(process.env.SESSION_TTL_HOURS);
  return Number.isFinite(horas) && horas > 0 ? horas : TTL_POR_DEFECTO_HORAS;
}

// En Docker local el acceso es http y un Secure impediría la cookie. Detrás de TLS se activa por variable.
function atributosFijos(): string {
  const secure = process.env.SESSION_COOKIE_SECURE === "true" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function serializarCookieSesion(token: string, maxAgeSegundos: number): string {
  return `${nombreCookieSesion()}=${token}; ${atributosFijos()}; Max-Age=${Math.floor(maxAgeSegundos)}`;
}

export function serializarCookieBorrada(): string {
  return `${nombreCookieSesion()}=; ${atributosFijos()}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
