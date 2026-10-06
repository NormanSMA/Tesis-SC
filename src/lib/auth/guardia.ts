import { redirect } from "next/navigation";

import { can } from "@/core/autorizacion";
import type { Permiso } from "@/core/permisos";

import { obtenerSesion, type UsuarioSesion } from "./sesion";

// Guardia de páginas de servidor. La ocultación del menú es solo comodidad: aquí se decide el acceso.
export async function exigirPermisoPagina(permiso: Permiso): Promise<UsuarioSesion> {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  if (!can(usuario, permiso)) redirect("/sin-acceso");
  return usuario;
}
