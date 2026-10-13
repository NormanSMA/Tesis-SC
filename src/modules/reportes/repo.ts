import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { limitesFecha } from "@/modules/inventario/reglas";
import { TERMINALES } from "@/modules/ordenes/reglas";
import type { ConsultaReporte } from "./schema";

// El importe se expresa en córdobas equivalentes: nunca se suman monedas distintas (ADR-018).
export function consultarCotizaciones(consulta: ConsultaReporte) {
  const { gte, lt } = limitesFecha(consulta);
  return prisma.$queryRaw<{ estado: string; cantidad: number; importe: string }[]>`
    SELECT estado::text AS estado, count(*)::int AS cantidad,
      coalesce(sum(round(total * tipo_cambio, 2)), 0)::text AS importe
    FROM cotizacion
    WHERE (${gte ?? null}::timestamptz IS NULL OR creado_en >= ${gte ?? null}::timestamptz)
      AND (${lt ?? null}::timestamptz IS NULL OR creado_en < ${lt ?? null}::timestamptz)
    GROUP BY estado ORDER BY estado`;
}
type MaterialReporte = { codigo: string; material: string; unidad: string; existencia: string;
  stockMinimo: string; costoPromedio?: string; valorExacto?: string };
export function consultarExistencias(consulta: ConsultaReporte, dinero: boolean) {
  const texto = `%${(consulta.texto ?? "").replace(/[\\%_]/g, "\\$&")}%`;
  const importes = dinero ? Prisma.sql`, costo_promedio::text AS "costoPromedio",
    (existencia * costo_promedio)::text AS "valorExacto"` : Prisma.empty;
  return prisma.$queryRaw<MaterialReporte[]>`SELECT codigo, nombre AS material, unidad::text,
    existencia::text, stock_minimo::text AS "stockMinimo" ${importes}
    FROM material WHERE activo AND (nombre ILIKE ${texto} OR codigo ILIKE ${texto} OR descripcion ILIKE ${texto})
      AND (${consulta.soloAlertas !== "true"} OR (stock_minimo > 0 AND existencia <= stock_minimo))
    ORDER BY nombre, id`;
}
export async function consultarCarga(entrada: { consulta: ConsultaReporte; hoy: string }) {
  const periodo = limitesFecha(entrada.consulta);
  const desde = periodo.gte ?? new Date("0001-01-01T06:00:00Z");
  const hasta = periodo.lt ?? new Date("9999-12-31T23:59:59Z");
  return prisma.$queryRaw<{ responsableId: string | null; responsable: string; pendientes: number; enCurso: number;
    completadas: number; atrasadas: number; ordenes: number }[]>`
    WITH etapas AS (
      SELECT e.*, o.estado NOT IN ('ENTREGADA', 'CERRADA', 'CANCELADA') AS abierta
      FROM etapa_orden e JOIN orden_trabajo o ON o.id = e.orden_id
    ), responsables AS (
      SELECT responsable_id AS id FROM etapas
      UNION SELECT responsable_id FROM orden_trabajo WHERE estado NOT IN ('ENTREGADA', 'CERRADA', 'CANCELADA')
    ) SELECT r.id AS "responsableId", COALESCE(u.nombre, 'Sin responsable') AS responsable,
      count(e.id) FILTER (WHERE e.abierta AND e.estado = 'PENDIENTE')::int AS pendientes,
      count(e.id) FILTER (WHERE e.abierta AND e.estado = 'EN_CURSO')::int AS "enCurso",
      count(e.id) FILTER (WHERE e.estado = 'COMPLETADA' AND e.fecha_fin_real >= ${desde}
        AND e.fecha_fin_real < ${hasta})::int AS completadas,
      count(e.id) FILTER (WHERE e.abierta AND e.estado IN ('PENDIENTE', 'EN_CURSO')
        AND e.fecha_fin_plan < ${entrada.hoy}::date)::int AS atrasadas,
      (SELECT count(*)::int FROM orden_trabajo o WHERE o.responsable_id IS NOT DISTINCT FROM r.id
        AND o.estado NOT IN ('ENTREGADA', 'CERRADA', 'CANCELADA')) AS ordenes
    FROM responsables r LEFT JOIN usuario u ON u.id = r.id
      LEFT JOIN etapas e ON e.responsable_id IS NOT DISTINCT FROM r.id
    GROUP BY r.id, u.nombre ORDER BY responsable, r.id`;
}
export function consultarEtapaActual(consulta: ConsultaReporte) {
  return prisma.ordenTrabajo.findMany({ where: { estado: { notIn: TERMINALES } },
    select: { id: true, estado: true, fechaEntrega: true, etapas: {
      where: { estado: { in: ["PENDIENTE", "EN_CURSO"] } }, orderBy: { secuencia: "asc" }, take: 1,
      select: { nombre: true, areaId: true, area: { select: { nombre: true } } },
    } }, orderBy: { id: "asc" } }).then((ordenes) => ordenes.filter((orden) =>
      !consulta.area || orden.etapas[0]?.areaId === consulta.area));
}
