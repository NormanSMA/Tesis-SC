import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { limitesManagua, type ConsultaBitacora } from "./schema";

const persona = { id: true, nombre: true } as const;
export const incluirEventos = {
  usuario: { select: persona },
  orden: { select: { id: true, numero: true, cotizacion: { select: { numero: true, cliente: { select: persona } } } } },
  cotizacion: { select: { id: true, numero: true, cliente: { select: persona }, orden: { select: { id: true, numero: true } } } },
} satisfies Prisma.BitacoraInclude;
export type EventoGuardado = Prisma.BitacoraGetPayload<{ include: typeof incluirEventos }>;
const incluirHistorialEtapa = { usuario: { select: persona }, responsable: { select: persona },
  etapa: { select: { id: true, nombre: true } } } satisfies Prisma.HistorialEtapaInclude;
export type HistorialEtapaGuardado = Prisma.HistorialEtapaGetPayload<{ include: typeof incluirHistorialEtapa }>;
const incluirCadena = { cotizacion: { include: { cliente: true } }, responsable: { select: persona },
  creadoPor: { select: persona }, etapas: { orderBy: { secuencia: "asc" as const },
    include: { area: { select: persona }, responsable: { select: persona } } } };
export type CadenaGuardada = Prisma.OrdenTrabajoGetPayload<{ include: typeof incluirCadena }>;

export function buscarCadena(tx: Tx, id: string) {
  return tx.ordenTrabajo.findUnique({ where: { id }, include: incluirCadena });
}
export function consultarEventosOrden(tx: Tx, orden: CadenaGuardada) {
  return tx.bitacora.findMany({ where: { OR: [{ ordenId: orden.id }, { cotizacionId: orden.cotizacionId }] },
    include: incluirEventos, orderBy: [{ creadoEn: "asc" }, { id: "asc" }] });
}
export function consultarHistorialEtapas(tx: Tx, ordenId: string) {
  return tx.historialEtapa.findMany({ where: { ordenId }, include: incluirHistorialEtapa,
    orderBy: [{ creadoEn: "asc" }, { id: "asc" }] });
}

async function registrosPorTexto(tx: Tx, texto: Prisma.StringFilter) {
  const [clientes, materiales, productos, categorias, areas, etapas, movimientos] = await Promise.all([
    tx.cliente.findMany({ where: { nombre: texto }, select: { id: true } }),
    tx.material.findMany({ where: { OR: [{ nombre: texto }, { codigo: texto }] }, select: { id: true } }),
    tx.producto.findMany({ where: { OR: [{ nombre: texto }, { codigo: texto }] }, select: { id: true } }),
    tx.categoria.findMany({ where: { nombre: texto }, select: { id: true } }),
    tx.area.findMany({ where: { nombre: texto }, select: { id: true } }),
    tx.etapaOrden.findMany({ where: { nombre: texto }, select: { id: true } }),
    tx.movimientoInventario.findMany({ where: { material: { OR: [{ nombre: texto }, { codigo: texto }] } }, select: { id: true } }),
  ]);
  return [...clientes, ...materiales, ...productos, ...categorias, ...areas, ...etapas, ...movimientos].map((fila) => fila.id);
}

async function filtroGlobal(tx: Tx, consulta: ConsultaBitacora): Promise<Prisma.BitacoraWhereInput> {
  const AND: Prisma.BitacoraWhereInput[] = [];
  if (consulta.entidad) AND.push({ entidad: consulta.entidad });
  if (consulta.accion) AND.push({ accion: consulta.accion });
  if (consulta.usuario) AND.push({ usuarioId: consulta.usuario });
  if (consulta.orden) AND.push({ OR: [{ orden: { numero: consulta.orden } }, { cotizacion: { orden: { numero: consulta.orden } } }] });
  if (consulta.cotizacion) AND.push({ OR: [{ cotizacion: { numero: consulta.cotizacion } }, { orden: { cotizacion: { numero: consulta.cotizacion } } }] });
  if (consulta.desde || consulta.hasta) AND.push({ creadoEn: limitesManagua(consulta) });
  if (consulta.texto) {
    const texto = { contains: consulta.texto.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
    AND.push({ OR: [{ usuario: { nombre: texto } }, { entidadId: { in: await registrosPorTexto(tx, texto) } },
      { orden: { OR: [{ numero: texto }, { cotizacion: { OR: [{ numero: texto }, { asunto: texto }, { cliente: { nombre: texto } }] } }] } },
      { cotizacion: { OR: [{ numero: texto }, { asunto: texto }, { cliente: { nombre: texto } }] } }] });
  }
  return { AND };
}

export async function consultarGlobal(tx: Tx, consulta: ConsultaBitacora) {
  const where = await filtroGlobal(tx, consulta);
  const [eventos, total] = await Promise.all([
    tx.bitacora.findMany({ where, include: incluirEventos, orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }), tx.bitacora.count({ where }),
  ]);
  return { eventos, total };
}
export function consultarUsuarios(tx: Tx) {
  return tx.usuario.findMany({ where: { eventosBitacora: { some: {} } }, select: persona, orderBy: [{ nombre: "asc" }, { id: "asc" }] });
}
export function buscarTrabajo(tx: Tx, numero: string) {
  return tx.ordenTrabajo.findFirst({ where: { OR: [{ numero: { equals: numero, mode: "insensitive" } },
    { cotizacion: { numero: { equals: numero, mode: "insensitive" } } }] }, select: { id: true, numero: true } });
}
