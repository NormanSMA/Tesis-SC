import { Prisma, type EstadoOrden } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { TERMINALES } from "./reglas";
import type { ConsultaOrdenes } from "./schema";
import type { CampoOrdenOrdenes, ConteosOrdenes, OrdenFila } from "./tipos";

const TERMINALES_CONTEOS: EstadoOrden[] = ["CERRADA", "CANCELADA"];

const incluirCotizacion = {
  cliente: true,
  items: { orderBy: { secuencia: "asc" as const }, include: {
    categoria: { select: { id: true, nombre: true } },
    producto: { include: { receta: { include: { material: true } } } },
    lineasCosto: { orderBy: { secuencia: "asc" as const }, include: { material: true } },
  } },
};
const incluirLista = {
  cliente: true,
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

function filtroLista(consulta: ConsultaOrdenes, hoy: string): Prisma.OrdenTrabajoWhereInput {
  const condiciones: Prisma.OrdenTrabajoWhereInput[] = [];
  if (consulta.terminales !== "todas") condiciones.push({ estado: consulta.terminales === "true" ? { in: TERMINALES } : { notIn: TERMINALES } });
  if (consulta.estado) condiciones.push({ estado: consulta.estado });
  if (consulta.responsable) condiciones.push({ responsableId: consulta.responsable === "sin-responsable" ? null : consulta.responsable });
  if (consulta.cliente) condiciones.push({ clienteId: consulta.cliente });
  if (consulta.vencidas === "true") condiciones.push({ fechaEntrega: { lt: new Date(hoy) }, estado: { notIn: TERMINALES } });
  if (consulta.q) {
    const texto = { contains: consulta.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
    condiciones.push({ OR: [{ numero: texto }, { cotizacion: { asunto: texto } }, { cliente: { nombre: texto } }] });
  }
  return { AND: condiciones };
}

function ordenLista(orden: ConsultaOrdenes["orden"]): Prisma.OrdenTrabajoOrderByWithRelationInput[] {
  const { campo, direccion } = orden ?? { campo: "creadoEn", direccion: "desc" };
  const campos: Record<CampoOrdenOrdenes, Prisma.OrdenTrabajoOrderByWithRelationInput> = {
    numero: { numero: direccion }, cliente: { cliente: { nombre: direccion } },
    fechaEntrega: { fechaEntrega: direccion }, creadoEn: { creadoEn: direccion },
  };
  return [campos[campo], { id: direccion }];
}

async function consultarAvances(ids: string[]) {
  const avances = new Map<string, NonNullable<OrdenFila["avance"]>>();
  if (!ids.length) return avances;
  const etapas = await prisma.etapaOrden.groupBy({ by: ["ordenId", "estado"],
    where: { ordenId: { in: ids }, estado: { not: "OMITIDA" } }, _count: { _all: true } });
  for (const etapa of etapas) {
    const avance = avances.get(etapa.ordenId) ?? { completadas: 0, total: 0 };
    avance.total += etapa._count._all;
    if (etapa.estado === "COMPLETADA") avance.completadas += etapa._count._all;
    avances.set(etapa.ordenId, avance);
  }
  return avances;
}

export async function consultarOrdenes(consulta: ConsultaOrdenes, hoy = hoyManagua()) {
  const where = filtroLista(consulta, hoy);
  const [filas, total] = await Promise.all([
    prisma.ordenTrabajo.findMany({ where, include: incluirLista, orderBy: ordenLista(consulta.orden),
      skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }),
    prisma.ordenTrabajo.count({ where }),
  ]);
  const avances = await consultarAvances(filas.map((fila) => fila.id));
  return { filas, total, avances };
}

export async function consultarConteosOrdenes(consulta: ConsultaOrdenes, hoy = hoyManagua()): Promise<ConteosOrdenes> {
  const where = filtroLista({ ...consulta, estado: undefined, responsable: undefined,
    vencidas: "false", terminales: "todas" }, hoy);
  const activas = { estado: { notIn: TERMINALES_CONTEOS } };
  const [porEstado, atrasadas, sinResponsable] = await Promise.all([
    prisma.ordenTrabajo.groupBy({ by: ["estado"], where, _count: { _all: true } }),
    prisma.ordenTrabajo.count({ where: { AND: [where, activas, { fechaEntrega: { lt: new Date(hoy) } }] } }),
    prisma.ordenTrabajo.count({ where: { AND: [where, activas, { responsableId: null }] } }),
  ]);
  const conteos: ConteosOrdenes = { PENDIENTE: 0, EN_PRODUCCION: 0, LISTA: 0, ENTREGADA: 0,
    CERRADA: 0, CANCELADA: 0, activas: 0, atrasadas, sinResponsable };
  for (const fila of porEstado) {
    conteos[fila.estado] = fila._count._all;
    if (!TERMINALES_CONTEOS.includes(fila.estado)) conteos.activas += fila._count._all;
  }
  return conteos;
}

export type CambiosOrden = {
  responsableId?: string | null; fechaEntrega?: Date; especificaciones?: string | null;
  estado?: string; fechaInicioReal?: Date; fechaEntregaReal?: Date; fechaCierre?: Date; motivoCancelacion?: string;
};
const COLUMNAS = { responsableId: "responsable_id", fechaEntrega: "fecha_entrega", especificaciones: "especificaciones",
  estado: "estado", fechaInicioReal: "fecha_inicio_real", fechaEntregaReal: "fecha_entrega_real", fechaCierre: "fecha_cierre", motivoCancelacion: "motivo_cancelacion" };
type CondicionEscritura = { id: string; estado: string; version: string };

export async function actualizarCondicionado(tx: Tx, condicion: CondicionEscritura, cambios: CambiosOrden): Promise<boolean> {
  const asignaciones = Object.entries(cambios).filter(([, valor]) => valor !== undefined).map(([campo, valor]) => {
    const columna = Prisma.raw(COLUMNAS[campo as keyof CambiosOrden]);
    if (campo === "responsableId") return Prisma.sql`${columna} = ${valor}::uuid`;
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
  return tx.usuario.findMany({ where: { activo: true, perfiles: { some: { perfil: { codigo: "PRODUCCION" } } } },
    select: { id: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] });
}

export async function consultarOpciones() {
  const [responsables, categorias] = await Promise.all([
    consultarResponsables(), prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, _count: { select: { etapasPlantilla: { where: { activo: true } } } } } }),
  ]);
  return { responsables, categorias: categorias.map((categoria) => ({ id: categoria.id, nombre: categoria.nombre, etapas: categoria._count.etapasPlantilla })) };
}
