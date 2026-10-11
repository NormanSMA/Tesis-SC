import type { PerfilCodigo } from "@/core/permisos";
import { AppError } from "@/lib/errores";

type CambioUsuario = {
  actorId: string;
  actual: { id: string; activo: boolean; perfiles: readonly PerfilCodigo[] };
  nuevo: { activo: boolean; perfiles: readonly PerfilCodigo[] };
  administradoresActivos: number;
};

export function validarPerfilesUsuario({ activo, perfiles }: { activo: boolean; perfiles: readonly PerfilCodigo[] }): void {
  if (activo && perfiles.length === 0) {
    throw new AppError({ codigo: "USUARIO_SIN_PERFIL", mensaje: "Asigne al menos un perfil.", status: 409 });
  }
}

export function validarCambioUsuario({ actorId, actual, nuevo, administradoresActivos }: CambioUsuario): void {
  validarPerfilesUsuario(nuevo);
  const eraAdmin = actual.perfiles.includes("ADMIN");
  const conservaAdmin = nuevo.perfiles.includes("ADMIN");
  if (eraAdmin && actual.id === actorId && (!conservaAdmin || !nuevo.activo)) {
    throw new AppError({
      codigo: "ADMIN_PROPIO", mensaje: "No puede quitarse ADMIN ni desactivarse.", status: 409,
    });
  }
  const pierdeAdminActivo = actual.activo && eraAdmin && (!nuevo.activo || !conservaAdmin);
  if (pierdeAdminActivo && administradoresActivos <= 1) {
    throw new AppError({
      codigo: "ULTIMO_ADMIN", mensaje: "Debe conservar al menos un usuario ADMIN activo.", status: 409,
    });
  }
}

export function validarVersionUsuario(actualizadoEn: Date, version: string): void {
  if (actualizadoEn.getTime() === new Date(version).getTime()) return;
  throw new AppError({
    codigo: "CONFLICTO_EDICION", mensaje: "El usuario cambió. Recargue los datos.", status: 409,
  });
}
