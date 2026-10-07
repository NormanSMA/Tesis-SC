import { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { TERMINALES } from "./reglas";
import type { ConsultaOrdenes } from "./schema";

const incluirCotizacion = {
  cliente: true,
  items: { orderBy: { secuencia: "asc" as const }, include: {
    categoria: { select: { id: true, nombre: true } },
    producto: { include: { receta: { include: { material: true } } } },
    lineasCosto: { orderBy: { secuencia: "asc" as const }, include: { material: true } },
  } },
};
const incluirLista = {
  cotizacion: { include: { cliente: true } }, categoria: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true } },
};
const incluirFicha = {
  ...incluirLista, cotizacion: { include: incluirCotizacion },
  etapas: { orderBy: { secuencia: "asc" as const }, include: {
    area: { select: { id: true, nombre: true } }, responsable: { select: { id: true, nombre: true } },
  } },
  consumosEstimados: { orderBy: { material: { nombre: "asc" as const } }, include: { material: true } },
  eventosBitacora: { orderBy: [{ creadoEn: "asc" as const }, { id: "asc" as const }],
    include: { usuario: { select: { nombre: true } } } },
};
export type CotizacionGuardada = Prisma.CotizacionGetPayload<{ include: typeof incluirCotizacion }>;
export type FilaGuardada = Prisma.OrdenTrabajoGetPayload<{ include: typeof incluirLista }>;
export type FichaGuardada = Prisma.OrdenTrabajoGetPayload<{ include: typeof incluirFicha }>;

export function buscarOrden(tx: Tx, id: string): Promise<FichaGuardada | null> {
  return tx.ordenTrabajo.findUnique({ where: { id }, include: incluirFicha });
}
export function buscarOrdenDeCotizacion(tx: Tx, cotizacionId: string) {
  return tx.ordenTrabajo.findUnique({ where: { cotizacionId }, select: { id: true, numero: true } });
}
export function buscarCotizacion(tx: Tx, id: string): Promise<CotizacionGuardada | null> {
  return tx.cotizacion.findUnique({ where: { id }, include: incluirCotizacion });
}

function filtroLista(consulta: ConsultaOrdenes): Prisma.OrdenTrabajoWhereInput {
  const condiciones: Prisma.OrdenTrabajoWhereInput[] = [];
  if (consulta.terminales !== "todas") condiciones.push({ estado: consulta.terminales === "true" ? { in: TERMINALES } : { notIn: TERMINALES } });
  if (consulta.estado) condiciones.push({ estado: consulta.estado });
  if (consulta.responsable) condiciones.push({ responsableId: consulta.responsable });
  if (consulta.cliente) condiciones.push({ cotizacion: { clienteId: consulta.cliente } });
  if (consulta.vencidas === "true") condiciones.push({ fechaEntrega: { lt: new Date(hoyManagua()) }, estado: { notIn: TERMINALES } });
  if (consulta.q) {
    const texto = { contains: consulta.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
    condiciones.push({ OR: [{ numero: texto }, { cotizacion: { asunto: texto } }, { cotizacion: { cliente: { nombre: texto } } }] });
  }
  return { AND: condiciones };
}

export async function consultarOrdenes(consulta: ConsultaOrdenes) {
  const where = filtroLista(consulta);
  const [filas, total] = await Promise.all([
    prisma.ordenTrabajo.findMany({ where, include: incluirLista, orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }),
    prisma.ordenTrabajo.count({ where }),
  ]);
  return { filas, total };
}

export type CambiosOrden = {
  responsableId?: string; fechaEntrega?: Date; especificaciones?: string | null;
  estado?: string; fechaInicioReal?: Date; fechaEntregaReal?: Date; fechaCierre?: Date; motivoCancelacion?: string;
};
const COLUMNAS = { responsableId: "responsable_id", fechaEntrega: "fecha_entrega", especificaciones: "especificaciones",
  estado: "estado", fechaInicioReal: "fecha_inicio_real", fechaEntregaReal: "fecha_entrega_real", fechaCierre: "fecha_cierre", motivoCancelacion: "motivo_cancelacion" };
type CondicionEscritura = { id: string; estado: string; version: string };

export async function actualizarCondicionado(tx: Tx, condicion: CondicionEscritura, cambios: CambiosOrden): Promise<boolean> {
  if (cambios.estado === "EN_PRODUCCION") cambios = { ...cambios, fechaInicioReal: cambios.fechaInicioReal ?? new Date() };
  const asignaciones = Object.entries(cambios).filter(([, valor]) => valor !== undefined).map(([campo, valor]) => {
    const columna = Prisma.raw(COLUMNAS[campo as keyof CambiosOrden]);
    if (campo === "fechaInicioReal") return Prisma.sql`${columna} = COALESCE(fecha_inicio_real, ${valor})`;
    return campo === "estado" ? Prisma.sql`${columna} = ${valor}::estado_orden` : Prisma.sql`${columna} = ${valor}`;
  });
  const desde = new Date(condicion.version);
  const afectadas = await tx.$executeRaw`
    UPDATE orden_trabajo SET ${Prisma.join(asignaciones)}, actualizado_en = GREATEST(
      date_trunc('milliseconds', clock_timestamp()),
      date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${condicion.id}::uuid AND estado = ${condicion.estado}::estado_orden
      AND actualizado_en >= ${desde}::timestamptz
      AND actualizado_en < ${desde}::timestamptz + interval '1 millisecond'`;
  return afectadas === 1;
}

export async function siguienteNumero(tx: Tx): Promise<string> {
  const [fila] = await tx.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero('ORDEN_TRABAJO') AS numero`;
  return fila.numero;
}

export function consultarResponsables(tx: Tx = prisma) {
  return tx.usuario.findMany({ where: { activo: true, perfil: { codigo: "PRODUCCION" } },
    select: { id: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] });
}

export async function consultarOpciones() {
  const [responsables, categorias] = await Promise.all([
    consultarResponsables(), prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, _count: { select: { etapasPlantilla: { where: { activo: true } } } } } }),
  ]);
  return { responsables, categorias: categorias.map((categoria) => ({ id: categoria.id, nombre: categoria.nombre, etapas: categoria._count.etapasPlantilla })) };
}
