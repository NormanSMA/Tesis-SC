import { AppError } from "@/lib/errores";

import type { Permiso, PerfilCodigo } from "./permisos";

export type Actor = {
  id: string;
  nombre: string;
  correo: string;
  // Perfil principal (primero según PERFILES) y todos los perfiles del usuario.
  perfil: PerfilCodigo;
  perfiles: readonly PerfilCodigo[];
  permisos: readonly string[];
};

export function can(actor: Actor, permiso: Permiso): boolean {
  return actor.permisos.includes(permiso);
}

export function exigir(actor: Actor, permiso: Permiso): void {
  if (can(actor, permiso)) return;
  throw new AppError({
    codigo: "SIN_PERMISO",
    mensaje: "No tiene permiso para realizar esta acción.",
    status: 403,
  });
}
