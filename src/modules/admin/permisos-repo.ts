import type { PerfilCodigo } from "@/core/permisos";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";

const SELECCION_PERFIL = {
  id: true, codigo: true, nombre: true, descripcion: true,
  permisos: { select: { permiso: { select: { id: true, recurso: true, accion: true } } } },
} satisfies Prisma.PerfilSelect;

export type PerfilConPermisos = Prisma.PerfilGetPayload<{ select: typeof SELECCION_PERFIL }>;

export function consultarPerfilesPermisos(tx: Tx) {
  return tx.perfil.findMany({ select: SELECCION_PERFIL, orderBy: { codigo: "asc" } });
}

export function consultarCatalogoPermisos(tx: Tx) {
  return tx.permiso.findMany({ orderBy: [{ recurso: "asc" }, { accion: "asc" }] });
}

export async function bloquearPerfilPermisos(tx: Tx, codigo: PerfilCodigo) {
  // Serialice reemplazos del mismo perfil antes de calcular las diferencias.
  await tx.$queryRaw`SELECT id FROM perfil WHERE codigo::text = ${codigo} FOR UPDATE`;
  return tx.perfil.findUnique({ where: { codigo }, select: SELECCION_PERFIL });
}

export async function aplicarDiferenciasPermisos(tx: Tx, datos: {
  perfilId: string; actorId: string; altas: string[]; bajas: string[];
}): Promise<void> {
  if (datos.bajas.length) {
    await tx.perfilPermiso.deleteMany({
      where: { perfilId: datos.perfilId, permisoId: { in: datos.bajas } },
    });
  }
  if (datos.altas.length) {
    await tx.perfilPermiso.createMany({
      data: datos.altas.map((permisoId) => ({
        perfilId: datos.perfilId, permisoId, otorgadoPorId: datos.actorId,
      })),
    });
  }
}
