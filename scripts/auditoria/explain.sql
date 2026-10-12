-- Planes de consulta con volumen (cargar antes scripts/auditoria/volumen.sql). Solo lectura.
-- Ejecucion:
--   docker exec -i sc-plataforma-db_test-1 psql -U sc_owner -d aud_inv_test -v ON_ERROR_STOP=1 -f - < scripts/auditoria/explain.sql
-- Cada consulta reproduce el SQL que genera el repositorio indicado (Prisma o SQL crudo) con parametros literales.

\set ON_ERROR_STOP on
BEGIN READ ONLY;

SELECT current_date::text AS hoy, now() AS instante \gset
SELECT md5('usr4')::uuid AS actor, md5('cli1')::uuid AS cliente, md5('ord7')::uuid AS orden \gset

\echo === a) 25 ordenes recientes con cliente (ordenes/repo.ts consultarOrdenes)
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.*, c.nombre AS cliente_nombre, q.asunto FROM orden_trabajo o
JOIN cliente c ON c.id = o.cliente_id JOIN cotizacion q ON q.id = o.cotizacion_id
ORDER BY o.creado_en DESC, o.id DESC LIMIT 25;

\echo === a2) ordenes activas (terminales=false) 25 recientes + count
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.*, c.nombre FROM orden_trabajo o JOIN cliente c ON c.id = o.cliente_id
WHERE o.estado NOT IN ('CERRADA','CANCELADA') ORDER BY o.creado_en DESC, o.id DESC LIMIT 25;
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM orden_trabajo WHERE estado NOT IN ('CERRADA','CANCELADA');

\echo === b) 50 movimientos recientes con material (inventario/repo.ts consultarMovimientos)
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.*, t.nombre, t.codigo FROM movimiento_inventario m JOIN material t ON t.id = m.material_id
ORDER BY m.creado_en DESC, m.id DESC LIMIT 50;
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM movimiento_inventario;

\echo === c) cotizaciones de un cliente por estado (cotizaciones/repo.ts)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM cotizacion WHERE cliente_id = :'cliente' AND estado = 'ENVIADA' ORDER BY creado_en DESC, id DESC LIMIT 25;

\echo === d) bitacora de una orden por fecha
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM bitacora WHERE orden_id = :'orden' ORDER BY creado_en DESC LIMIT 50;

\echo === e) materiales bajo el minimo (inventario/repo.ts filtroAlerta)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM material WHERE activo AND stock_minimo > 0 AND existencia <= stock_minimo ORDER BY nombre, id LIMIT 25;
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM material WHERE activo AND stock_minimo > 0 AND existencia <= stock_minimo;

\echo === f) clientes con busqueda ILIKE %ab% (clientes/repo.ts consultarClientes)
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.*, (SELECT count(*) FROM cotizacion q WHERE q.cliente_id = c.id) AS cotizaciones FROM cliente c
WHERE c.activo AND (c.codigo_cliente ILIKE '%ab%' OR c.nombre ILIKE '%ab%' OR c.ruc ILIKE '%ab%'
  OR c.contacto_principal ILIKE '%ab%' OR c.correo ILIKE '%ab%')
ORDER BY c.nombre, c.id LIMIT 25;
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM cliente c WHERE c.activo AND (c.codigo_cliente ILIKE '%ab%' OR c.nombre ILIKE '%ab%'
  OR c.ruc ILIKE '%ab%' OR c.contacto_principal ILIKE '%ab%' OR c.correo ILIKE '%ab%');

\echo === g1) panel consultarOperacion (hoy, soloAtrasadas=false)
EXPLAIN (ANALYZE, BUFFERS)
    WITH activas AS (SELECT *, (:'hoy'::date - fecha_entrega)::int AS dias,
      responsable_id IS NULL AS "sinResponsable" FROM orden_trabajo WHERE estado NOT IN ('CERRADA', 'CANCELADA')),
    atencion AS (SELECT * FROM activas WHERE dias > 0 OR (NOT false AND "sinResponsable"))
    SELECT count(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes,
      count(*) FILTER (WHERE "sinResponsable")::int AS "sinResponsable",
      count(*) FILTER (WHERE estado = 'EN_PRODUCCION')::int AS "enProduccion",
      count(*) FILTER (WHERE dias > 0)::int AS atrasadas,
      count(*) FILTER (WHERE fecha_entrega BETWEEN :'hoy'::date AND :'hoy'::date + 7)::int AS entregas,
      (SELECT count(*)::int FROM atencion) AS accion,
      (SELECT coalesce(jsonb_agg(f ORDER BY f.dias DESC, f.numero, f.id), '[]') FROM
        (SELECT id, numero, dias, "sinResponsable" FROM atencion ORDER BY dias DESC, numero, id LIMIT 5) f) AS filas,
      (SELECT jsonb_agg(jsonb_build_object('etiqueta', s.estado, 'valor',
        (SELECT count(*)::int FROM activas a WHERE a.estado::text = s.estado)) ORDER BY s.posicion)
        FROM unnest(ARRAY['PENDIENTE','EN_PRODUCCION','LISTA','ENTREGADA','CERRADA','CANCELADA'])
        WITH ORDINALITY s(estado, posicion)) AS "porEstado" FROM activas;

\echo === g2) panel consultarMaterialesPanel (verDinero=true)
EXPLAIN (ANALYZE, BUFFERS)
    WITH materiales AS (SELECT * FROM material WHERE activo),
    alertas AS (SELECT * FROM materiales WHERE stock_minimo > 0 AND existencia <= stock_minimo)
    SELECT (SELECT count(*)::int FROM alertas) AS "bajoMinimo",
      CASE WHEN true THEN coalesce(sum(existencia * costo_promedio), 0)::text ELSE '0' END AS valor,
      (SELECT coalesce(jsonb_agg(f ORDER BY f.proporcion, f.nombre, f.id), '[]') FROM
        (SELECT id, nombre, existencia::text, stock_minimo::text AS minimo, unidad::text,
          existencia / stock_minimo AS proporcion FROM alertas
          ORDER BY proporcion, nombre, id LIMIT 5) f) AS filas FROM materiales;

\echo === g3) panel consultarComercial
EXPLAIN (ANALYZE, BUFFERS)
    WITH fechas AS (SELECT :'hoy'::date AS hoy, date_trunc('month', :'hoy'::date)::date AS mes),
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
        WITH ORDINALITY s(estado, posicion)) AS "porEstado";

\echo === g4) panel consultarClientesNuevos
EXPLAIN (ANALYZE, BUFFERS)
    SELECT count(*)::int AS cantidad FROM cliente WHERE
      (creado_en AT TIME ZONE 'America/Managua')::date >= date_trunc('month', :'hoy'::date)::date
      AND (creado_en AT TIME ZONE 'America/Managua')::date < date_trunc('month', :'hoy'::date)::date + interval '1 month';

\echo === g5) panel consultarProduccion (actor = usr4)
EXPLAIN (ANALYZE, BUFFERS)
    WITH propias AS (SELECT e.*, o.numero FROM etapa_orden e JOIN orden_trabajo o ON o.id = e.orden_id
      WHERE e.responsable_id = :'actor'::uuid AND o.estado NOT IN ('CERRADA','CANCELADA')
        AND e.estado IN ('PENDIENTE','EN_CURSO')),
    atencion AS (SELECT *, greatest(:'hoy'::date - fecha_fin_plan, 0)::int AS dias FROM propias
      WHERE fecha_fin_plan < :'hoy'::date OR (estado = 'EN_CURSO' AND fecha_inicio_real < :'instante'::timestamptz - interval '2 days')),
    completadas AS (SELECT (h.creado_en AT TIME ZONE 'America/Managua')::date AS dia FROM historial_etapa h
      WHERE h.usuario_id = :'actor'::uuid AND h.responsable_id = :'actor'::uuid AND h.estado_nuevo = 'COMPLETADA'
      AND (h.creado_en AT TIME ZONE 'America/Managua')::date BETWEEN :'hoy'::date - 6 AND :'hoy'::date)
    SELECT count(*) FILTER (WHERE estado = 'EN_CURSO')::int AS "enCurso",
      count(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes,
      count(*) FILTER (WHERE fecha_fin_plan < :'hoy'::date)::int AS atrasadas,
      (SELECT count(*)::int FROM completadas WHERE dia = :'hoy'::date) AS "completadasHoy",
      (SELECT count(*)::int FROM atencion) AS "atencionTotal",
      (SELECT coalesce(jsonb_agg(f ORDER BY f.dias DESC, f.numero, f.id), '[]') FROM
        (SELECT id, orden_id AS "ordenId", nombre, numero, dias FROM atencion
          ORDER BY dias DESC, numero, id LIMIT 5) f) AS filas,
      (SELECT jsonb_agg(jsonb_build_object('etiqueta', d.dia::date::text, 'valor',
        (SELECT count(*)::int FROM completadas c WHERE c.dia = d.dia::date)) ORDER BY d.dia)
        FROM generate_series(:'hoy'::date - 6, :'hoy'::date, interval '1 day') d(dia)) AS "porDia" FROM propias;

\echo === g6) panel consultarMovimientos
EXPLAIN (ANALYZE, BUFFERS)
    WITH fechas AS (SELECT :'hoy'::date AS hoy, date_trunc('week', :'hoy'::date)::date AS semana),
    movimientos AS (SELECT tipo, (creado_en AT TIME ZONE 'America/Managua')::date AS dia FROM movimiento_inventario
      WHERE creado_en >= ((SELECT semana - 35 FROM fechas)::timestamp AT TIME ZONE 'America/Managua')
        AND (creado_en AT TIME ZONE 'America/Managua')::date >= (SELECT semana - 35 FROM fechas)
        AND (creado_en AT TIME ZONE 'America/Managua')::date <= :'hoy'::date)
    SELECT count(*) FILTER (WHERE tipo = 'CONSUMO' AND dia = :'hoy'::date)::int AS "consumosHoy",
      count(*) FILTER (WHERE dia >= (SELECT semana FROM fechas))::int AS "movimientosSemana",
      (SELECT jsonb_agg(jsonb_build_object('etiqueta', s.inicio::date::text, 'valor',
        (SELECT count(*)::int FROM movimientos m WHERE m.tipo = 'CONSUMO' AND m.dia >= s.inicio
          AND m.dia < s.inicio + interval '1 week')) ORDER BY s.inicio)
        FROM generate_series((SELECT semana FROM fechas) - interval '5 weeks',
          (SELECT semana FROM fechas), interval '1 week') s(inicio)) AS semanas FROM movimientos;

ROLLBACK;
