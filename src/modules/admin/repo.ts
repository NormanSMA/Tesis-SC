import type { PerfilCodigo } from "@/core/permisos";
import { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import type { ConsultaUsuarios, EntradaCrearUsuario } from "./schema";

// Seleccione campos públicos para impedir filtraciones incluso antes del DTO.
const SELECCION_USUARIO = {
  id: true, nombre: true, correo: true, activo: true, intentosFallidos: true,
  bloqueadoHasta: true, ultimoAcceso: true, creadoEn: true, actualizadoEn: true,
  perfiles: { select: { perfil: { select: { codigo: true } } } },
} satisfies Prisma.UsuarioSelect;

export type UsuarioPublico = Prisma.UsuarioGetPayload<{ select: typeof SELECCION_USUARIO }>;

export function buscarUsuario(tx: Tx, id: string): Promise<UsuarioPublico | null> {
  return tx.usuario.findUnique({ where: { id }, select: SELECCION_USUARIO });
}

export async function bloquearAdministradores(tx: Tx): Promise<number> {
  // La fila estable serializa también promociones y altas durante cambios de perfiles.
  await tx.$queryRaw`SELECT id FROM perfil WHERE codigo = 'ADMIN' FOR UPDATE`;
  await tx.$queryRaw`
    SELECT u.id FROM usuario u
    JOIN usuario_perfil up ON up.usuario_id = u.id
    JOIN perfil p ON p.id = up.perfil_id
    WHERE p.codigo = 'ADMIN' ORDER BY u.id FOR UPDATE OF u`;
  // Lea nuevamente tras esperar: READ COMMITTED obtiene el estado confirmado.
  return tx.usuario.count({ where: { activo: true, perfiles: { some: { perfil: { codigo: "ADMIN" } } } } });
}

export async function bloquearUsuario(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function consultarUsuarios(consulta: ConsultaUsuarios) {
  const where: Prisma.UsuarioWhereInput = { activo: consulta.activo };
  if (consulta.perfil) where.perfiles = { some: { perfil: { codigo: consulta.perfil } } };
  if (consulta.q) {
    const contiene = { contains: consulta.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
    where.OR = [{ nombre: contiene }, { correo: contiene }];
  }
  const [filas, total] = await Promise.all([
    prisma.usuario.findMany({
      where, select: SELECCION_USUARIO, orderBy: [{ nombre: "asc" }, { id: "asc" }],
      skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina,
    }),
    prisma.usuario.count({ where }),
  ]);
  return { filas, total };
}

async function exigirPerfiles(tx: Tx, codigos: readonly PerfilCodigo[]) {
  const perfiles = await tx.perfil.findMany({ where: { codigo: { in: [...codigos] } } });
  if (perfiles.length !== codigos.length) {
    throw new AppError({ codigo: "PERFIL_INVALIDO", mensaje: "Un perfil no existe.", status: 422 });
  }
  return perfiles;
}

export async function insertarUsuario(tx: Tx, datos: EntradaCrearUsuario & {
  hashContrasena: string; actorId: string; contrasenaTemporalExpiraEn: Date;
}) {
  const perfiles = await exigirPerfiles(tx, datos.perfiles);
  return tx.usuario.create({
    data: {
      nombre: datos.nombre, correo: datos.correo, hashContrasena: datos.hashContrasena,
      contrasenaTemporal: true, contrasenaTemporalExpiraEn: datos.contrasenaTemporalExpiraEn,
      perfiles: { create: perfiles.map((perfil) => ({ perfilId: perfil.id, asignadoPorId: datos.actorId })) },
    },
    select: SELECCION_USUARIO,
  });
}

export async function reemplazarPerfiles(
  tx: Tx, usuarioId: string, datos: { perfiles: readonly PerfilCodigo[]; actorId: string },
): Promise<void> {
  const perfiles = await exigirPerfiles(tx, datos.perfiles);
  const ids = perfiles.map((perfil) => perfil.id);
  await tx.usuarioPerfil.deleteMany({ where: { usuarioId, perfilId: { notIn: ids } } });
  await tx.usuarioPerfil.createMany({
    data: ids.map((perfilId) => ({ usuarioId, perfilId, asignadoPorId: datos.actorId })), skipDuplicates: true,
  });
}

type EscrituraUsuario = {
  id: string; actualizadoEn: Date;
  cambios: Pick<Prisma.UsuarioUpdateInput, "nombre" | "correo" | "activo" | "hashContrasena" |
    "intentosFallidos" | "bloqueadoHasta" | "contrasenaTemporal" | "contrasenaTemporalExpiraEn">;
};

export function actualizarUsuario(tx: Tx, { id, actualizadoEn, cambios }: EscrituraUsuario) {
  const siguienteVersion = new Date(Math.max(Date.now(), actualizadoEn.getTime() + 1));
  return tx.usuario.update({
    where: { id }, data: { ...cambios, actualizadoEn: siguienteVersion }, select: SELECCION_USUARIO,
  });
}

export async function revocarSesiones(tx: Tx, usuarioId: string): Promise<void> {
  await tx.sesion.updateMany({ where: { usuarioId, revocadaEn: null }, data: { revocadaEn: new Date() } });
}
