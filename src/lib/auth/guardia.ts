import { redirect } from "next/navigation";

import { can } from "@/core/autorizacion";
import type { Permiso } from "@/core/permisos";
import { AppError } from "@/lib/errores";

import { obtenerSesion, type UsuarioSesion } from "./sesion";

// Guardia de páginas de servidor. La ocultación del menú es solo comodidad: aquí se decide el acceso.
export async function exigirPermisoPagina(permiso: Permiso): Promise<UsuarioSesion> {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  if (usuario.debeCambiarClave) redirect("/cambiar-clave");
  if (!can(usuario, permiso)) redirect("/sin-acceso");
  return usuario;
}

export function exigirClaveCambiada(usuario: Pick<UsuarioSesion, "debeCambiarClave">, ruta: string): void {
  const excepciones = ["/api/v1/auth/yo", "/api/v1/auth/logout", "/api/v1/auth/cambiar-clave"];
  if (!usuario.debeCambiarClave || excepciones.includes(ruta)) return;
  throw new AppError({
    codigo: "CAMBIO_DE_CLAVE_REQUERIDO",
    mensaje: "Cambie su clave temporal para continuar.",
    status: 403,
  });
}
