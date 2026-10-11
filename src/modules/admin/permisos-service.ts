import { exigir, type Actor } from "@/core/autorizacion";
import type { PerfilCodigo } from "@/core/permisos";
import type { Permiso } from "@/generated/prisma/client";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { aMatrizPermisosDto, aPermisosPerfilDto, codigoPermiso } from "./permisos-dto";
import {
  aplicarDiferenciasPermisos, bloquearPerfilPermisos, consultarCatalogoPermisos, consultarPerfilesPermisos,
} from "./permisos-repo";
import {
  calcularDiferenciasPermisos, esquemaPerfilPermisos, validarPermisosPerfil, type EntradaReemplazarPermisos,
} from "./permisos-schema";

export function leerPerfilPermisos(valor: string | string[] | undefined): PerfilCodigo {
  const resultado = esquemaPerfilPermisos.safeParse(valor);
  if (resultado.success) return resultado.data;
  throw new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El perfil no existe.", status: 404 });
}

export async function listarPermisos(actor: Actor) {
  exigir(actor, "permiso:gestionar");
  return prisma.$transaction(async (tx) => {
    const perfiles = await consultarPerfilesPermisos(tx);
    const catalogo = await consultarCatalogoPermisos(tx);
    return aMatrizPermisosDto(perfiles, catalogo);
  });
}

async function registrarDiferencias(tx: Tx, datos: {
  perfilId: string; perfil: PerfilCodigo; actorId: string;
  altas: string[]; bajas: string[]; catalogo: Map<string, Permiso>;
}): Promise<void> {
  for (const [accion, codigos] of [
    ["OTORGAR_PERMISO", datos.altas], ["REVOCAR_PERMISO", datos.bajas],
  ] as const) {
    for (const codigo of codigos) {
      const permiso = datos.catalogo.get(codigo)!;
      // La asociación tiene clave compuesta; use el UUID del perfil para la entidad.
      await registrarEvento(tx, {
        entidad: "PERFIL_PERMISO", entidadId: datos.perfilId, accion, actorId: datos.actorId,
        detalle: { perfil: datos.perfil, recurso: permiso.recurso, accion: permiso.accion },
      });
    }
  }
}

export async function reemplazarPermisosPerfil(
  perfil: PerfilCodigo, entrada: EntradaReemplazarPermisos, actor: Actor,
) {
  exigir(actor, "permiso:gestionar");
  validarPermisosPerfil(perfil, entrada.permisos);
  return prisma.$transaction(async (tx) => {
    const actual = await bloquearPerfilPermisos(tx, perfil);
    if (!actual) throw new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El perfil no existe.", status: 404 });
    const catalogo = new Map((await consultarCatalogoPermisos(tx)).map((permiso) => [codigoPermiso(permiso), permiso]));
    if (entrada.permisos.some((codigo) => !catalogo.has(codigo))) {
      throw new AppError({ codigo: "PERMISO_INVALIDO", mensaje: "Un permiso no existe.", status: 422 });
    }
    const { altas, bajas } = calcularDiferenciasPermisos(aPermisosPerfilDto(actual).permisos, entrada.permisos);
    await aplicarDiferenciasPermisos(tx, {
      perfilId: actual.id, actorId: actor.id,
      altas: altas.map((codigo) => catalogo.get(codigo)!.id),
      bajas: bajas.map((codigo) => catalogo.get(codigo)!.id),
    });
    await registrarDiferencias(tx, { perfilId: actual.id, perfil, actorId: actor.id, altas, bajas, catalogo });
    return { perfil, permisos: [...entrada.permisos].sort() };
  });
}
