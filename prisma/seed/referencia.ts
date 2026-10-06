import { CATALOGO_PERMISOS, PERFILES, PERMISOS_POR_PERFIL } from "../../src/core/permisos";
import type { Tx } from "../../src/lib/db";

function partirPermiso(permiso: string): { recurso: string; accion: string } {
  const [recurso, accion] = permiso.split(":");
  return { recurso, accion };
}

// Idempotente. Agrega lo que falta y no quita permisos que el administrador haya añadido a la matriz.
export async function sembrarReferencia(db: Tx): Promise<void> {
  for (const { codigo, nombre, descripcion } of PERFILES) {
    await db.perfil.upsert({ where: { codigo }, update: { nombre, descripcion }, create: { codigo, nombre, descripcion } });
  }
  for (const { permiso, descripcion } of CATALOGO_PERMISOS) {
    const clave = partirPermiso(permiso);
    await db.permiso.upsert({
      where: { recurso_accion: clave },
      update: { descripcion },
      create: { ...clave, descripcion },
    });
  }
  await sembrarMatriz(db);
}

async function sembrarMatriz(db: Tx): Promise<void> {
  const perfiles = await db.perfil.findMany({ select: { id: true, codigo: true } });
  const permisos = await db.permiso.findMany({ select: { id: true, recurso: true, accion: true } });
  const idPermiso = new Map(permisos.map((p) => [`${p.recurso}:${p.accion}`, p.id]));
  for (const { id: perfilId, codigo } of perfiles) {
    const concedidos = PERMISOS_POR_PERFIL[codigo].map((permiso) => ({
      perfilId,
      permisoId: idPermiso.get(permiso) as string,
    }));
    await db.perfilPermiso.createMany({ data: concedidos, skipDuplicates: true });
  }
}
