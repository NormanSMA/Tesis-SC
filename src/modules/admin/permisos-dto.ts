import { PERFILES, type PerfilCodigo } from "@/core/permisos";
import type { Permiso } from "@/generated/prisma/client";

import type { PerfilConPermisos } from "./permisos-repo";

export function codigoPermiso(permiso: { recurso: string; accion: string }): string {
  return `${permiso.recurso}:${permiso.accion}`;
}

export type PermisosPerfilDto = { perfil: PerfilCodigo; permisos: string[] };

export function aPermisosPerfilDto(perfil: PerfilConPermisos): PermisosPerfilDto {
  return {
    perfil: perfil.codigo,
    permisos: perfil.permisos.map(({ permiso }) => codigoPermiso(permiso)).sort(),
  };
}

export function aMatrizPermisosDto(perfiles: PerfilConPermisos[], catalogo: Permiso[]) {
  const ordenados = PERFILES.flatMap(({ codigo }) => perfiles.filter((perfil) => perfil.codigo === codigo));
  const recursos = [...new Set(catalogo.map(({ recurso }) => recurso))];
  return {
    perfiles: ordenados.map(({ id, codigo, nombre, descripcion }) => ({ id, codigo, nombre, descripcion })),
    permisos: recursos.map((recurso) => ({
      recurso,
      permisos: catalogo.filter((permiso) => permiso.recurso === recurso).map((permiso) => ({
        id: permiso.id, codigo: codigoPermiso(permiso), accion: permiso.accion, descripcion: permiso.descripcion,
      })),
    })),
    matriz: ordenados.map(aPermisosPerfilDto),
  };
}
