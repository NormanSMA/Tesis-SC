import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { limitesManagua, type ConsultaBitacora } from "./schema";

const persona = { id: true, nombre: true } as const;
const porLote = 100;
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
  creadoPor: { select: persona } };
const incluirEtapas = { area: { select: persona }, responsable: { select: persona } };
export type CadenaGuardada = Prisma.OrdenTrabajoGetPayload<{ include: typeof incluirCadena }> & {
  etapas: Prisma.EtapaOrdenGetPayload<{ include: typeof incluirEtapas }>[];
};

async function leerLista<T extends { id: string }>(
  consultar: (paginacion: { take: number; cursor?: { id: string }; skip?: number }) => Promise<T[]>,
) {
  const filas: T[] = [];
  let cursor: { id: string } | undefined;
  while (true) {
    const pagina = await consultar({ take: porLote, ...(cursor ? { cursor, skip: 1 } : {}) });
    filas.push(...pagina);
    if (pagina.length < porLote) return filas;
    cursor = { id: pagina[pagina.length - 1].id };
  }
}

export async function buscarCadena(tx: Tx, id: string) {
  const orden = await tx.ordenTrabajo.findUnique({ where: { id }, include: incluirCadena });
  if (!orden) return null;
  const etapas = await leerLista((paginacion) => tx.etapaOrden.findMany({ where: { ordenId: id },
    include: incluirEtapas, orderBy: [{ secuencia: "asc" }, { id: "asc" }], ...paginacion }));
  return { ...orden, etapas };
}
export function consultarEventosOrden(tx: Tx, orden: CadenaGuardada) {
  return leerLista((paginacion) => tx.bitacora.findMany({
    where: { OR: [{ ordenId: orden.id }, { cotizacionId: orden.cotizacionId }] },
    include: incluirEventos, orderBy: [{ creadoEn: "asc" }, { id: "asc" }], ...paginacion }));
}
export function consultarHistorialEtapas(tx: Tx, ordenId: string) {
  return leerLista((paginacion) => tx.historialEtapa.findMany({ where: { ordenId }, include: incluirHistorialEtapa,
    orderBy: [{ creadoEn: "asc" }, { id: "asc" }], ...paginacion }));
}

function registrosPorTexto(texto: string) {
  return Prisma.sql`
    EXISTS (SELECT 1 FROM cliente r WHERE r.id = b.entidad_id AND r.nombre ILIKE ${texto})
    OR EXISTS (SELECT 1 FROM material r WHERE r.id = b.entidad_id
      AND (r.nombre ILIKE ${texto} OR r.codigo ILIKE ${texto}))
    OR EXISTS (SELECT 1 FROM producto r WHERE r.id = b.entidad_id
      AND (r.nombre ILIKE ${texto} OR r.codigo ILIKE ${texto}))
    OR EXISTS (SELECT 1 FROM categoria r WHERE r.id = b.entidad_id AND r.nombre ILIKE ${texto})
    OR EXISTS (SELECT 1 FROM area r WHERE r.id = b.entidad_id AND r.nombre ILIKE ${texto})
    OR EXISTS (SELECT 1 FROM etapa_orden r WHERE r.id = b.entidad_id AND r.nombre ILIKE ${texto})
    OR EXISTS (SELECT 1 FROM movimiento_inventario r JOIN material m ON m.id = r.material_id
      WHERE r.id = b.entidad_id AND (m.nombre ILIKE ${texto} OR m.codigo ILIKE ${texto}))`;
}

function filtroGlobal(consulta: ConsultaBitacora) {
  const filtros: Prisma.Sql[] = [];
  if (consulta.entidad) filtros.push(Prisma.sql`b.entidad = ${consulta.entidad}::entidad_bitacora`);
  if (consulta.accion) filtros.push(Prisma.sql`b.accion = ${consulta.accion}::accion_bitacora`);
  if (consulta.usuario) filtros.push(Prisma.sql`b.usuario_id = ${consulta.usuario}::uuid`);
  if (consulta.orden) filtros.push(Prisma.sql`(o.numero = ${consulta.orden} OR oc.numero = ${consulta.orden})`);
  if (consulta.cotizacion) filtros.push(Prisma.sql`(c.numero = ${consulta.cotizacion} OR co.numero = ${consulta.cotizacion})`);
  const { gte, lt } = limitesManagua(consulta);
  if (gte) filtros.push(Prisma.sql`b.creado_en >= ${gte}`);
  if (lt) filtros.push(Prisma.sql`b.creado_en < ${lt}`);
  if (consulta.texto) {
    const texto = `%${consulta.texto.replace(/[\\%_]/g, "\\$&")}%`;
    filtros.push(Prisma.sql`(u.nombre ILIKE ${texto} OR ${registrosPorTexto(texto)}
      OR o.numero ILIKE ${texto} OR oc.numero ILIKE ${texto}
      OR co.numero ILIKE ${texto} OR co.asunto ILIKE ${texto}
      OR clo.nombre ILIKE ${texto} OR c.numero ILIKE ${texto} OR c.asunto ILIKE ${texto}
      OR cl.nombre ILIKE ${texto})`);
  }
  return filtros.length ? Prisma.sql`WHERE ${Prisma.join(filtros, " AND ")}` : Prisma.empty;
}

const relacionesGlobal = Prisma.sql`
  FROM bitacora b JOIN usuario u ON u.id = b.usuario_id
  LEFT JOIN orden_trabajo o ON o.id = b.orden_id
  LEFT JOIN cotizacion co ON co.id = o.cotizacion_id
  LEFT JOIN cliente clo ON clo.id = co.cliente_id
  LEFT JOIN cotizacion c ON c.id = b.cotizacion_id
  LEFT JOIN cliente cl ON cl.id = c.cliente_id
  LEFT JOIN orden_trabajo oc ON oc.cotizacion_id = c.id`;

const columnasEventos = Prisma.sql`
  b.id, b.entidad, b.entidad_id AS "entidadId", b.orden_id AS "ordenId",
  b.cotizacion_id AS "cotizacionId", b.accion, b.estado_anterior AS "estadoAnterior",
  b.estado_nuevo AS "estadoNuevo", b.usuario_id AS "usuarioId", b.creado_en AS "creadoEn", b.detalle,
  jsonb_build_object('id', u.id, 'nombre', u.nombre) AS usuario,
  CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('id', o.id, 'numero', o.numero,
    'cotizacion', jsonb_build_object('numero', co.numero,
      'cliente', jsonb_build_object('id', clo.id, 'nombre', clo.nombre))) END AS orden,
  CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'numero', c.numero,
    'cliente', jsonb_build_object('id', cl.id, 'nombre', cl.nombre),
    'orden', CASE WHEN oc.id IS NULL THEN NULL ELSE jsonb_build_object('id', oc.id, 'numero', oc.numero) END)
  END AS cotizacion`;

export async function consultarGlobal(tx: Tx, consulta: ConsultaBitacora) {
  const where = filtroGlobal(consulta);
  const [eventos, conteo] = await Promise.all([
    tx.$queryRaw<EventoGuardado[]>(Prisma.sql`SELECT ${columnasEventos} ${relacionesGlobal} ${where}
      ORDER BY b.creado_en DESC, b.id DESC LIMIT ${consulta.porPagina}
      OFFSET ${(consulta.pagina - 1) * consulta.porPagina}`),
    tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${relacionesGlobal} ${where}`),
  ]);
  return { eventos, total: Number(conteo[0].total) };
}
export function consultarUsuarios(tx: Tx) {
  return leerLista((paginacion) => tx.usuario.findMany({ where: { eventosBitacora: { some: {} } },
    select: persona, orderBy: [{ nombre: "asc" }, { id: "asc" }], ...paginacion }));
}
export function buscarTrabajo(tx: Tx, numero: string) {
  return tx.ordenTrabajo.findFirst({ where: { OR: [{ numero: { equals: numero, mode: "insensitive" } },
    { cotizacion: { numero: { equals: numero, mode: "insensitive" } } }] },
    select: { id: true, numero: true }, orderBy: { id: "asc" } });
}
