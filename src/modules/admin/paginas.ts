import { notFound } from "next/navigation";

import { exigir, type Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errores";
import type { FiltrosUsuarios } from "@/modules/admin/componentes/interfaz";
import { aUsuarioDto } from "@/modules/admin/dto";
import { leerIdUsuario, obtenerUsuario } from "@/modules/admin/service";

const POR_PAGINA = 20;

const SELECCION_LISTA = {
  id: true, nombre: true, correo: true, activo: true, intentosFallidos: true,
  bloqueadoHasta: true, ultimoAcceso: true, creadoEn: true, actualizadoEn: true,
  perfiles: { select: { perfil: { select: { codigo: true } } } },
} satisfies Prisma.UsuarioSelect;

export async function cargarUsuario(id: string, actor: Actor) {
  try {
    return { usuario: await obtenerUsuario(leerIdUsuario(id), actor), ahora: Date.now() };
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

function filtroEstado(estado: FiltrosUsuarios["estado"], ahora: Date): Prisma.UsuarioWhereInput {
  if (estado === "ACTIVO") return { activo: true };
  if (estado === "INACTIVO") return { activo: false };
  if (estado === "BLOQUEADO") return { activo: true, bloqueadoHasta: { gt: ahora } };
  return {};
}

function filtroUsuarios(filtros: FiltrosUsuarios, ahora: Date): Prisma.UsuarioWhereInput {
  const contiene = { contains: filtros.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
  return {
    ...filtroEstado(filtros.estado, ahora),
    ...(filtros.perfil && { perfiles: { some: { perfil: { codigo: filtros.perfil } } } }),
    ...(filtros.q && { OR: [{ nombre: contiene }, { correo: contiene }] }),
  };
}

export async function cargarUsuarios(filtros: FiltrosUsuarios, actor: Actor) {
  exigir(actor, "usuario:gestionar");
  const ahora = Date.now();
  const where = filtroUsuarios(filtros, new Date(ahora));
  const [filas, total, activos, bloqueados] = await Promise.all([
    prisma.usuario.findMany({
      where, select: SELECCION_LISTA, orderBy: [{ nombre: "asc" }, { id: "asc" }],
      skip: (filtros.pagina - 1) * POR_PAGINA, take: POR_PAGINA,
    }),
    prisma.usuario.count({ where }),
    prisma.usuario.count({ where: { activo: true } }),
    prisma.usuario.count({ where: { activo: true, bloqueadoHasta: { gt: new Date(ahora) } } }),
  ]);
  return { datos: filas.map(aUsuarioDto), total, pagina: filtros.pagina, porPagina: POR_PAGINA, ahora, activos, bloqueados };
}
