import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { nombreUnidad } from "@/lib/formato";
import { cantidadMaterialPanel } from "./dto";
import type { FilaOperativaDto, UrgenciaFeed } from "./tipos";

export type FuenteFeed = { filas: FilaOperativaDto[]; total: number };
type EntradaFuente = { hoy: string; instante: Date; actorId: string; verDinero: boolean };

async function consultarFuente(fuente: Prisma.Sql): Promise<FuenteFeed> {
  const [resultado] = await prisma.$queryRaw<FuenteFeed[]>`
    WITH fuente AS (${fuente})
    SELECT count(*)::int AS total,
      (SELECT coalesce(jsonb_agg(f ORDER BY f.gravedad, f.dias DESC, f.codigo, f.id), '[]')
        FROM (SELECT * FROM fuente ORDER BY gravedad, dias DESC, codigo, id LIMIT 5) f) AS filas
    FROM fuente`;
  return { total: resultado.total, filas: resultado.filas.map((fila) => ({
    ...fila, referencia: new Date(fila.referencia).toISOString(),
  })) };
}

export function consultarCotizacionesFeed(entrada: EntradaFuente, urgencia: UrgenciaFeed): Promise<FuenteFeed> {
  const { hoy, instante, verDinero } = entrada;
  const envio = Prisma.sql`(c.fecha_emision::timestamp AT TIME ZONE 'America/Managua')`;
  const referencia = urgencia === "POR_VENCER" ? Prisma.sql`(c.fecha_vencimiento::timestamp AT TIME ZONE 'America/Managua')`
    : urgencia === "AJUSTE_SOLICITADO" ? Prisma.sql`c.fecha_respuesta` : envio;
  const condicion = urgencia === "AJUSTE_SOLICITADO"
    ? Prisma.sql`c.estado = 'AJUSTE_SOLICITADO' AND NOT EXISTS (SELECT 1 FROM cotizacion corregida
        WHERE corregida.cotizacion_origen_id = c.id AND corregida.version > c.version)`
    : urgencia === "SIN_RESPUESTA"
      ? Prisma.sql`c.estado = 'ENVIADA' AND c.fecha_respuesta IS NULL AND ${envio} < ${instante}::timestamptz - interval '3 days'`
      : Prisma.sql`c.estado = 'ENVIADA' AND c.fecha_respuesta IS NULL AND c.fecha_vencimiento BETWEEN ${hoy}::date AND ${hoy}::date + 3`;
  const dinero = verDinero ? Prisma.sql`c.total::text AS monto, c.moneda AS moneda`
    : Prisma.sql`NULL::text AS monto, NULL::text AS moneda`;
  const detalle = urgencia === "AJUSTE_SOLICITADO" ? "Ajuste solicitado sin versión corregida"
    : urgencia === "SIN_RESPUESTA" ? "Enviada hace más de tres días sin respuesta" : "Vence en los próximos tres días";
  return consultarFuente(Prisma.sql`
    SELECT c.id, 'cotizacion' AS tipo, c.numero AS codigo, cl.nombre AS titulo,
      coalesce(nullif(c.asunto, ''), ${detalle}::text) AS detalle,
      ${urgencia}::text AS urgencia, ${urgencia === "AJUSTE_SOLICITADO" ? "alta" : "media"}::text AS gravedad,
      ${dinero}, ${referencia} AS referencia,
      greatest(floor(extract(epoch FROM (${instante}::timestamptz - ${referencia})) / 86400), 0)::int AS dias,
      '/cotizaciones/' || c.id AS destino FROM cotizacion c JOIN cliente cl ON cl.id = c.cliente_id
    WHERE NOT c.archivada AND ${condicion}`);
}

export function consultarOrdenesFeed(entrada: EntradaFuente, urgencia: "ORDEN_ATRASADA" | "SIN_RESPONSABLE"): Promise<FuenteFeed> {
  const { hoy, instante, verDinero } = entrada;
  const atrasada = urgencia === "ORDEN_ATRASADA";
  const referencia = atrasada ? Prisma.sql`(o.fecha_entrega::timestamp AT TIME ZONE 'America/Managua')` : Prisma.sql`o.creado_en`;
  const dinero = verDinero ? Prisma.sql`c.total::text AS monto, c.moneda AS moneda`
    : Prisma.sql`NULL::text AS monto, NULL::text AS moneda`;
  const enlace = verDinero ? Prisma.sql`JOIN cotizacion c ON c.id = o.cotizacion_id` : Prisma.empty;
  return consultarFuente(Prisma.sql`
    SELECT o.id, 'orden' AS tipo, o.numero AS codigo, cl.nombre AS titulo,
      ${atrasada ? "Revise la fecha de entrega" : "Asigne un responsable"}::text AS detalle,
      ${urgencia}::text AS urgencia, ${atrasada ? "alta" : "media"}::text AS gravedad, ${dinero},
      ${referencia} AS referencia,
      greatest(floor(extract(epoch FROM (${instante}::timestamptz - ${referencia})) / 86400), 0)::int AS dias,
      '/ordenes/' || o.id AS destino FROM orden_trabajo o JOIN cliente cl ON cl.id = o.cliente_id ${enlace}
    WHERE o.estado NOT IN ('CERRADA','CANCELADA')
      AND ${atrasada ? Prisma.sql`o.fecha_entrega < ${hoy}::date` : Prisma.sql`o.responsable_id IS NULL`}`);
}

// La consulta trae existencia, mínimo y unidad crudos; el texto se arma con el formato de cantidades de la interfaz.
type FilaMaterial = FilaOperativaDto & { existencia?: string; minimo?: string; unidad?: string };
function detalleMaterial(fila: FilaMaterial): FilaOperativaDto {
  const { existencia = "0", minimo = "0", unidad = "", ...resto } = fila;
  const cantidad = (valor: string) => cantidadMaterialPanel(valor, unidad);
  return { ...resto, detalle: `Existencia ${cantidad(existencia)} de ${cantidad(minimo)} ${nombreUnidad(unidad)}`.trim() };
}

export async function consultarMaterialesFeed(entrada: EntradaFuente): Promise<FuenteFeed> {
  const fuente = await consultarFuente(Prisma.sql`
    SELECT id, 'material' AS tipo, codigo, nombre AS titulo, '' AS detalle,
      existencia::text AS existencia, stock_minimo::text AS minimo, unidad::text AS unidad,
      'BAJO_MINIMO' AS urgencia, CASE WHEN existencia = 0 THEN 'alta' ELSE 'media' END AS gravedad,
      NULL::text AS monto, NULL::text AS moneda, actualizado_en AS referencia,
      greatest(floor(extract(epoch FROM (${entrada.instante}::timestamptz - actualizado_en)) / 86400), 0)::int AS dias,
      '/inventario/' || id AS destino FROM material WHERE activo AND stock_minimo > 0 AND existencia <= stock_minimo`);
  return { ...fuente, filas: fuente.filas.map(detalleMaterial) };
}

export function consultarEtapasFeed(entrada: EntradaFuente, urgencia: "ETAPA_ATRASADA" | "ETAPA_DETENIDA"): Promise<FuenteFeed> {
  const { hoy, instante, actorId } = entrada;
  const atrasada = urgencia === "ETAPA_ATRASADA";
  const referencia = atrasada ? Prisma.sql`(e.fecha_fin_plan::timestamp AT TIME ZONE 'America/Managua')` : Prisma.sql`e.fecha_inicio_real`;
  return consultarFuente(Prisma.sql`
    SELECT e.id, 'etapa' AS tipo, o.numero AS codigo, e.nombre AS titulo,
      ${atrasada ? "Revise la fecha de fin" : "En curso desde hace más de dos días"}::text AS detalle,
      ${urgencia}::text AS urgencia, ${atrasada ? "alta" : "media"}::text AS gravedad,
      NULL::text AS monto, NULL::text AS moneda, ${referencia} AS referencia,
      greatest(floor(extract(epoch FROM (${instante}::timestamptz - ${referencia})) / 86400), 0)::int AS dias,
      '/ordenes/' || o.id AS destino FROM etapa_orden e JOIN orden_trabajo o ON o.id = e.orden_id
    WHERE e.responsable_id = ${actorId}::uuid AND o.estado NOT IN ('CERRADA','CANCELADA')
      AND e.estado IN ('PENDIENTE','EN_CURSO')
      AND ${atrasada ? Prisma.sql`e.fecha_fin_plan < ${hoy}::date`
        : Prisma.sql`e.estado = 'EN_CURSO' AND e.fecha_inicio_real < ${instante}::timestamptz - interval '2 days'`}`);
}
