import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import { leerEntorno } from "@/env";

export function viaProxy(req: Request): boolean {
  const clave = leerEntorno().PROXY_CLAVE;
  if (!clave || clave.length < 32) return false;
  const recibida = Buffer.from(req.headers.get("x-proxy-clave") ?? "");
  const esperada = Buffer.from(clave);
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

export function ipCliente(req: Request): string {
  if (!viaProxy(req)) return "local";
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export function ipTruncada(ip: string): string {
  const version = isIP(ip);
  if (version === 4) return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  if (version !== 6) return "local";
  const [inicio, fin = ""] = ip.split("::");
  const primeros = inicio ? inicio.split(":") : [];
  const ultimos = fin ? fin.split(":") : [];
  const faltantes = 8 - primeros.length - ultimos.length - (ip.includes(".") ? 1 : 0);
  const grupos = [...primeros, ...Array<string>(faltantes).fill("0"), ...ultimos];
  return `${grupos.slice(0, 3).join(":")}::/48`;
}
