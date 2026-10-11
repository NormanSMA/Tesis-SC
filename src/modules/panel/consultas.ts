import { prisma } from "@/lib/db";
import type { PerfilCodigo } from "@/core/permisos";
import type { ComercialPanel, InventarioPanel, MovimientosPanel, OperacionPanel, ProduccionPanel } from "./tipos";

export async function consultarPerfilesPanel(perfiles: readonly PerfilCodigo[]) {
  return prisma.perfil.findMany({ where: { codigo: { in: perfiles.filter((perfil) => perfil !== "ADMIN") },
    permisos: { some: { permiso: { recurso: "panel", accion: "ver" } } } }, select: { codigo: true } });
}

export async function consultarOperacion(hoy: string, soloAtrasadas = false): Promise<OperacionPanel> {
  const [resultado] = await prisma.$queryRaw<OperacionPanel[]>`
    WITH activas AS (SELECT *, (${hoy}::date - fecha_entrega)::int AS dias,
      responsable_id IS NULL AS "sinResponsable" FROM orden_trabajo WHERE estado NOT IN ('CERRADA', 'CANCELADA')),
    atencion AS (SELECT * FROM activas WHERE dias > 0 OR (NOT ${soloAtrasadas} AND "sinResponsable"))
    SELECT count(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes,
      count(*) FILTER (WHERE "sinResponsable")::int AS "sinResponsable",
      count(*) FILTER (WHERE estado = 'EN_PRODUCCION')::int AS "enProduccion",
      count(*) FILTER (WHERE dias > 0)::int AS atrasadas,
      count(*) FILTER (WHERE fecha_entrega BETWEEN ${hoy}::date AND ${hoy}::date + 7)::int AS entregas,
      (SELECT count(*)::int FROM atencion) AS accion,
      (SELECT coalesce(jsonb_agg(f ORDER BY f.dias DESC, f.numero, f.id), '[]') FROM
        (SELECT id, numero, dias, "sinResponsable" FROM atencion ORDER BY dias DESC, numero, id LIMIT 5) f) AS filas,
      (SELECT jsonb_agg(jsonb_build_object('etiqueta', s.estado, 'valor',
        (SELECT count(*)::int FROM activas a WHERE a.estado::text = s.estado)) ORDER BY s.posicion)
        FROM unnest(ARRAY['PENDIENTE','EN_PRODUCCION','LISTA','ENTREGADA','CERRADA','CANCELADA'])
        WITH ORDINALITY s(estado, posicion)) AS "porEstado" FROM activas`;
  return resultado;
}

export async function consultarMaterialesPanel(verDinero: boolean): Promise<InventarioPanel> {
  const [resultado] = await prisma.$queryRaw<InventarioPanel[]>`
    WITH materiales AS (SELECT * FROM material WHERE activo),
    alertas AS (SELECT * FROM materiales WHERE stock_minimo > 0 AND existencia <= stock_minimo)
    SELECT (SELECT count(*)::int FROM alertas) AS "bajoMinimo",
      CASE WHEN ${verDinero} THEN coalesce(sum(existencia * costo_promedio), 0)::text ELSE '0' END AS valor,
      (SELECT coalesce(jsonb_agg(f ORDER BY f.proporcion, f.nombre, f.id), '[]') FROM
        (SELECT id, nombre, existencia::text, stock_minimo::text AS minimo, unidad::text,
          existencia / stock_minimo AS proporcion FROM alertas
          ORDER BY proporcion, nombre, id LIMIT 5) f) AS filas FROM materiales`;
  return resultado;
}

export async function consultarComercial(hoy: string): Promise<ComercialPanel> {
  const [resultado] = await prisma.$queryRaw<ComercialPanel[]>`
    WITH fechas AS (SELECT ${hoy}::date AS hoy, date_trunc('month', ${hoy}::date)::date AS mes),
    cotizaciones AS (SELECT c.*, coalesce((fecha_respuesta AT TIME ZONE 'America/Managua')::date,
      CASE WHEN estado = 'VENCIDA' THEN fecha_vencimiento END) AS respuesta FROM cotizacion c
      WHERE c.estado IN ('BORRADOR','ENVIADA','AJUSTE_SOLICITADO')
        OR c.creado_en >= (((SELECT mes FROM fechas) - interval '12 months')::timestamp AT TIME ZONE 'America/Managua')
        OR c.fecha_respuesta >= (((SELECT mes FROM fechas) - interval '12 months')::timestamp AT TIME ZONE 'America/Managua')
        OR c.fecha_vencimiento >= (SELECT mes FROM fechas) - interval '12 months'),
    meses AS (SELECT generate_series((SELECT mes FROM fechas) - interval '5 months',
      (SELECT mes FROM fechas), interval '1 month')::date AS mes),
    resumen AS (SELECT m.mes::text, coalesce(sum(c.total) FILTER (WHERE estado = 'APROBADA'), 0)::text AS monto,
      count(c.id) FILTER (WHERE estado = 'APROBADA')::int AS aprobadas,
      count(c.id) FILTER (WHERE estado IN ('APROBADA','RECHAZADA','AJUSTE_SOLICITADO','VENCIDA'))::int AS respondidas
      FROM meses m LEFT JOIN cotizaciones c ON c.respuesta >= m.mes AND c.respuesta < m.mes + interval '1 month'
      GROUP BY m.mes),
    pendientes AS (SELECT c.* FROM cotizaciones c, fechas f WHERE NOT c.archivada AND
      ((c.estado = 'ENVIADA' AND c.fecha_respuesta IS NULL AND c.fecha_vencimiento BETWEEN f.hoy AND f.hoy + 3) OR
      (c.estado = 'AJUSTE_SOLICITADO' AND NOT EXISTS (SELECT 1 FROM cotizacion corregida
        WHERE corregida.cotizacion_origen_id = c.id AND corregida.version > c.version))))
    SELECT (SELECT jsonb_agg(r ORDER BY r.mes) FROM resumen r) AS meses,
      (SELECT count(*)::int FROM cotizaciones c, fechas f WHERE NOT archivada AND estado = 'ENVIADA'
        AND fecha_vencimiento >= f.hoy AND fecha_respuesta IS NULL) AS enviadas,
      (SELECT count(*)::int FROM pendientes WHERE estado = 'ENVIADA') AS "porVencer",
      (SELECT count(*)::int FROM pendientes) AS "atencionTotal",
      (SELECT coalesce(jsonb_agg(p ORDER BY p.vencimiento NULLS LAST, p.numero, p.id), '[]') FROM
        (SELECT id, numero, estado, fecha_vencimiento::text AS vencimiento FROM pendientes
          ORDER BY fecha_vencimiento NULLS LAST, numero, id LIMIT 5) p) AS filas,
      (SELECT jsonb_agg(jsonb_build_object('etiqueta', s.estado, 'valor', (SELECT count(*)::int
        FROM cotizaciones c, fechas f WHERE c.estado::text = s.estado AND NOT c.archivada
          AND (c.creado_en AT TIME ZONE 'America/Managua')::date BETWEEN f.hoy - 29 AND f.hoy)) ORDER BY s.posicion)
        FROM unnest(ARRAY['BORRADOR','ENVIADA','APROBADA','RECHAZADA','AJUSTE_SOLICITADO','VENCIDA'])
        WITH ORDINALITY s(estado, posicion)) AS "porEstado"`;
  return resultado;
}

export async function consultarClientesNuevos(hoy: string): Promise<number> {
  const [resultado] = await prisma.$queryRaw<{ cantidad: number }[]>`
    SELECT count(*)::int AS cantidad FROM cliente WHERE
      (creado_en AT TIME ZONE 'America/Managua')::date >= date_trunc('month', ${hoy}::date)::date
      AND (creado_en AT TIME ZONE 'America/Managua')::date < date_trunc('month', ${hoy}::date)::date + interval '1 month'`;
  return resultado.cantidad;
}

export async function consultarProduccion(entrada: { hoy: string; instante: Date; actorId: string }): Promise<ProduccionPanel> {
  const { hoy, instante, actorId } = entrada;
  const [resultado] = await prisma.$queryRaw<ProduccionPanel[]>`
    WITH propias AS (SELECT e.*, o.numero FROM etapa_orden e JOIN orden_trabajo o ON o.id = e.orden_id
      WHERE e.responsable_id = ${actorId}::uuid AND o.estado NOT IN ('CERRADA','CANCELADA')
        AND e.estado IN ('PENDIENTE','EN_CURSO')),
    atencion AS (SELECT *, greatest(${hoy}::date - fecha_fin_plan, 0)::int AS dias FROM propias
      WHERE fecha_fin_plan < ${hoy}::date OR (estado = 'EN_CURSO' AND fecha_inicio_real < ${instante}::timestamptz - interval '2 days')),
    completadas AS (SELECT (h.creado_en AT TIME ZONE 'America/Managua')::date AS dia FROM historial_etapa h
      WHERE h.usuario_id = ${actorId}::uuid AND h.responsable_id = ${actorId}::uuid AND h.estado_nuevo = 'COMPLETADA'
      AND (h.creado_en AT TIME ZONE 'America/Managua')::date BETWEEN ${hoy}::date - 6 AND ${hoy}::date)
    SELECT count(*) FILTER (WHERE estado = 'EN_CURSO')::int AS "enCurso",
      count(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes,
      count(*) FILTER (WHERE fecha_fin_plan < ${hoy}::date)::int AS atrasadas,
      (SELECT count(*)::int FROM completadas WHERE dia = ${hoy}::date) AS "completadasHoy",
      (SELECT count(*)::int FROM atencion) AS "atencionTotal",
      (SELECT coalesce(jsonb_agg(f ORDER BY f.dias DESC, f.numero, f.id), '[]') FROM
        (SELECT id, orden_id AS "ordenId", nombre, numero, dias FROM atencion
          ORDER BY dias DESC, numero, id LIMIT 5) f) AS filas,
      (SELECT jsonb_agg(jsonb_build_object('etiqueta', d.dia::date::text, 'valor',
        (SELECT count(*)::int FROM completadas c WHERE c.dia = d.dia::date)) ORDER BY d.dia)
        FROM generate_series(${hoy}::date - 6, ${hoy}::date, interval '1 day') d(dia)) AS "porDia" FROM propias`;
  return resultado;
}

export async function consultarMovimientos(hoy: string): Promise<MovimientosPanel> {
  const [resultado] = await prisma.$queryRaw<MovimientosPanel[]>`
    WITH fechas AS (SELECT ${hoy}::date AS hoy, date_trunc('week', ${hoy}::date)::date AS semana),
    movimientos AS (SELECT tipo, (creado_en AT TIME ZONE 'America/Managua')::date AS dia FROM movimiento_inventario
      WHERE creado_en >= ((SELECT semana - 35 FROM fechas)::timestamp AT TIME ZONE 'America/Managua')
        AND (creado_en AT TIME ZONE 'America/Managua')::date >= (SELECT semana - 35 FROM fechas)
        AND (creado_en AT TIME ZONE 'America/Managua')::date <= ${hoy}::date)
    SELECT count(*) FILTER (WHERE tipo = 'CONSUMO' AND dia = ${hoy}::date)::int AS "consumosHoy",
      count(*) FILTER (WHERE dia >= (SELECT semana FROM fechas))::int AS "movimientosSemana",
      (SELECT jsonb_agg(jsonb_build_object('etiqueta', s.inicio::date::text, 'valor',
        (SELECT count(*)::int FROM movimientos m WHERE m.tipo = 'CONSUMO' AND m.dia >= s.inicio
          AND m.dia < s.inicio + interval '1 week')) ORDER BY s.inicio)
        FROM generate_series((SELECT semana FROM fechas) - interval '5 weeks',
          (SELECT semana FROM fechas), interval '1 week') s(inicio)) AS semanas FROM movimientos`;
  return resultado;
}
