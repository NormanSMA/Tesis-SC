import { cookies } from "next/headers";
import { cache } from "react";

import type { PerfilCodigo } from "@/core/permisos";
import { resolverSesion } from "@/modules/auth/service";

import { leerTokenDeCookies, nombreCookieSesion } from "./cookies";

export type { PerfilCodigo };

export type UsuarioSesion = {
  id: string;
  nombre: string;
  correo: string;
  perfil: PerfilCodigo;
  perfiles: PerfilCodigo[];
  permisos: string[];
  debeCambiarClave: boolean;
};

// Para páginas y layouts de servidor. Valida contra la base una vez por petición:
// layout y página comparten el resultado mediante la caché de React.
export const obtenerSesion = cache(async (): Promise<UsuarioSesion | null> => {
  const token = (await cookies()).get(nombreCookieSesion())?.value;
  return token ? resolverSesion(token) : null;
});

// Para rutas API: lee la cookie del encabezado, sin depender del contexto de Next.
export async function obtenerSesionDeRequest(req: Request): Promise<UsuarioSesion | null> {
  const token = leerTokenDeCookies(req.headers.get("cookie"));
  return token ? resolverSesion(token) : null;
}
