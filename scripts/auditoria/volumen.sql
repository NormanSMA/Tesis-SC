-- Carga sintetica de volumen para medir planes de consulta.
-- SOLO para una base desechable (aud_inv_test). Nunca ejecutar contra sc_plataforma.
-- Requisito: esquema aplicado con prisma migrate deploy y tablas vacias.
-- Ejecucion:
--   docker exec -i sc-plataforma-db_test-1 psql -U sc_owner -d aud_inv_test -v ON_ERROR_STOP=1 -f - < scripts/auditoria/volumen.sql
--
-- Los triggers de dominio (saldo, transiciones, solo insercion) se desactivan con
-- session_replication_role = replica durante la carga. Los CHECK y las claves foraneas siguen activos.
-- Por eso el script calcula el saldo (existencia, existencia_resultante) con las mismas reglas del libro.
-- Ids deterministas: md5('<prefijo><n>')::uuid, para enlazar tablas sin tablas temporales.

\set ON_ERROR_STOP on
\timing on

DO $$
BEGIN
  IF current_database() !~ '_test$' THEN
    RAISE EXCEPTION 'Se niega a cargar volumen en la base %, solo bases terminadas en _test', current_database();
  END IF;
  IF EXISTS (SELECT 1 FROM cliente) THEN
    RAISE EXCEPTION 'La base ya tiene clientes: vaciar el esquema antes de cargar';
  END IF;
END $$;

SET session_replication_role = replica;
SELECT setseed(0.42);

-- Usuarios (6): 1 gerencia/atencion y 5 operarios.
INSERT INTO usuario (id, nombre, correo, hash_contrasena, actualizado_en)
SELECT md5('usr' || i)::uuid, 'Usuario ' || i, 'usuario' || i || '@ejemplo.com', 'x', now()
FROM generate_series(1, 6) i;

INSERT INTO categoria (id, nombre) SELECT md5('cat' || i)::uuid, 'Categoria ' || i FROM generate_series(1, 5) i;
INSERT INTO area (id, nombre) SELECT md5('are' || i)::uuid, 'Area ' || i FROM generate_series(1, 6) i;

INSERT INTO producto (id, codigo, nombre, categoria_id, unidad_cobro, precio_base, actualizado_en)
SELECT md5('pro' || i)::uuid, 'PRO-' || lpad(i::text, 4, '0'), 'Producto ' || i, md5('cat' || (1 + i % 5))::uuid,
  'UNIDAD', 250, now()
FROM generate_series(1, 300) i;

-- Materiales (2000). stock_minimo se ajusta al final segun la existencia calculada.
INSERT INTO material (id, codigo, nombre, unidad, costo_promedio, actualizado_en)
SELECT md5('mat' || i)::uuid, 'MAT-' || lpad(i::text, 5, '0'), 'Material ' || i, 'UNIDAD', 10 + i % 7, now()
FROM generate_series(1, 2000) i;

-- Clientes (20000).
INSERT INTO cliente (id, codigo_cliente, nombre, tipo, correo, telefono, activo, creado_en, actualizado_en)
SELECT md5('cli' || i)::uuid, 'CLI-' || lpad(i::text, 5, '0'),
  (ARRAY['Rotulos','Imprenta','Comercial','Distribuidora','Servicios','Ferreteria','Farmacia','Hotel'])[1 + i % 8] || ' ' ||
  (ARRAY['Abel','Cabrera','Martinez','Lopez','Gabriela','Sandino','Rizo','Altamirano','Blandon','Zeledon'])[1 + (i / 8) % 10] || ' ' || i,
  CASE WHEN i % 3 = 0 THEN 'EMPRESA' ELSE 'PERSONA' END::tipo_cliente,
  'cliente' || i || '@ejemplo.com', '8' || lpad((i % 10000000)::text, 7, '0'), i % 20 <> 0,
  now() - (random() * 730) * interval '1 day', now()
FROM generate_series(1, 20000) i;

-- Cotizaciones (40000). 1..15000 APROBADAS (una orden cada una); el resto con estados mixtos.
INSERT INTO cotizacion (id, numero, cliente_id, estado, tasa_impuesto, subtotal, descuento, impuesto, total, vigencia_dias,
  fecha_emision, fecha_vencimiento, fecha_respuesta, motivo_ajuste, usuario_aprobacion_id, referencia_aprobacion,
  creado_por_id, creado_en, actualizado_en)
SELECT md5('cot' || i)::uuid, 'COT-2026-' || lpad(i::text, 6, '0'), md5('cli' || (1 + floor(random() * 20000)::int))::uuid,
  e.estado, 15, 1000, 0, 150, 1150, 15,
  CASE WHEN e.estado <> 'BORRADOR' THEN c.creado::date END,
  CASE WHEN e.estado <> 'BORRADOR' THEN c.creado::date + 15 END,
  CASE WHEN e.estado IN ('APROBADA','RECHAZADA','AJUSTE_SOLICITADO') THEN c.creado + interval '2 days' END,
  CASE WHEN e.estado = 'AJUSTE_SOLICITADO' THEN 'Ajuste de prueba' END,
  CASE WHEN e.estado = 'APROBADA' THEN md5('usr1')::uuid END,
  CASE WHEN e.estado = 'APROBADA' THEN 'REF-' || i END,
  md5('usr1')::uuid, c.creado, c.creado
FROM generate_series(1, 40000) i
CROSS JOIN LATERAL (SELECT now() - interval '365 days' + random() * CASE WHEN i <= 15000 THEN 345 ELSE 365 END * interval '1 day' AS creado) c
CROSS JOIN LATERAL (SELECT CASE WHEN i <= 15000 THEN 'APROBADA'
  ELSE (ARRAY['BORRADOR','ENVIADA','RECHAZADA','VENCIDA','AJUSTE_SOLICITADO'])[1 + i % 5] END::estado_cotizacion AS estado) e;

-- Items (2 por cotizacion): 2 x 250 x 2 = 1000 = subtotal.
INSERT INTO item_cotizacion (cotizacion_id, secuencia, tipo, producto_id, categoria_id, descripcion, unidad_cobro, cantidad,
  precio_unitario, importe)
SELECT md5('cot' || i)::uuid, s, 'CATALOGO', md5('pro' || p)::uuid, md5('cat' || (1 + p % 5))::uuid, 'Item ' || s, 'UNIDAD', 2, 250, 500
FROM generate_series(1, 40000) i
CROSS JOIN generate_series(1, 2) s
CROSS JOIN LATERAL (SELECT 1 + (i * 7 + s * 13) % 300 AS p) q;

-- Ordenes (15000): una por cotizacion aprobada, mismo cliente.
INSERT INTO orden_trabajo (id, numero, cotizacion_id, categoria_id, estado, responsable_id, cliente_id, fecha_entrega,
  fecha_inicio_real, fecha_entrega_real, fecha_cierre, motivo_cancelacion, creado_por_id, creado_en, actualizado_en)
SELECT md5('ord' || i)::uuid, 'OT-2026-' || lpad(i::text, 6, '0'), c.id, md5('cat' || (1 + i % 5))::uuid, e.estado,
  CASE WHEN i % 25 = 0 THEN NULL ELSE md5('usr' || (2 + i % 5))::uuid END, c.cliente_id,
  (c.creado_en + interval '15 days')::date,
  CASE WHEN e.estado IN ('EN_PRODUCCION','LISTA','ENTREGADA','CERRADA') THEN c.creado_en + interval '1 day' END,
  CASE WHEN e.estado IN ('ENTREGADA','CERRADA') THEN c.creado_en + interval '8 days' END,
  CASE WHEN e.estado = 'CERRADA' THEN c.creado_en + interval '10 days' END,
  CASE WHEN e.estado = 'CANCELADA' THEN 'Cancelada por prueba' END,
  md5('usr1')::uuid, c.creado_en + interval '1 hour', c.creado_en + interval '1 hour'
FROM generate_series(1, 15000) i
JOIN cotizacion c ON c.id = md5('cot' || i)::uuid
CROSS JOIN LATERAL (SELECT (ARRAY['PENDIENTE','PENDIENTE','EN_PRODUCCION','EN_PRODUCCION','LISTA','ENTREGADA','CERRADA',
  'CERRADA','CERRADA','CANCELADA'])[1 + i % 10]::estado_orden AS estado) e;

-- Etapas (3 por orden). EN_PRODUCCION: 1 completada, 2 en curso, 3 pendiente. LISTA/ENTREGADA/CERRADA: todas completadas.
INSERT INTO etapa_orden (id, orden_id, area_id, secuencia, nombre, estado, responsable_id, fecha_inicio_plan, fecha_fin_plan,
  fecha_inicio_real, fecha_fin_real, creado_en, actualizado_en)
SELECT md5('eta' || o.n || '-' || s)::uuid, o.id, md5('are' || (1 + (o.n + s) % 6))::uuid, s, 'Etapa ' || s, x.estado,
  CASE WHEN x.estado IN ('EN_CURSO','COMPLETADA') THEN md5('usr' || (2 + o.n % 5))::uuid END,
  o.creado_en::date + (s - 1) * 3, o.creado_en::date + s * 3,
  CASE WHEN x.estado IN ('EN_CURSO','COMPLETADA') THEN o.creado_en + (s - 1) * interval '2 days' END,
  CASE WHEN x.estado = 'COMPLETADA' THEN o.creado_en + (s - 1) * interval '2 days' + interval '1 day' END,
  o.creado_en, o.creado_en
FROM (SELECT t.*, row_number() OVER (ORDER BY t.numero)::int AS n FROM orden_trabajo t) o
CROSS JOIN generate_series(1, 3) s
CROSS JOIN LATERAL (SELECT CASE
  WHEN o.estado IN ('PENDIENTE','CANCELADA') THEN 'PENDIENTE'
  WHEN o.estado = 'EN_PRODUCCION' THEN (ARRAY['COMPLETADA','EN_CURSO','PENDIENTE'])[s]
  ELSE 'COMPLETADA' END::estado_etapa AS estado) x;

-- Historial de etapa: una fila por etapa EN_CURSO o COMPLETADA (la ultima transicion).
INSERT INTO historial_etapa (orden_id, etapa_id, usuario_id, estado_anterior, estado_nuevo, responsable_id, creado_en)
SELECT orden_id, id, responsable_id, 'PENDIENTE', estado, responsable_id, coalesce(fecha_fin_real, fecha_inicio_real)
FROM etapa_orden WHERE estado IN ('EN_CURSO','COMPLETADA');

-- Libro de movimientos (150000): 50000 ENTRADA (primeros 165 dias) y 100000 CONSUMO (ultimos 200 dias).
-- Las entradas ocurren antes que los consumos para que la existencia acumulada nunca sea negativa.
INSERT INTO movimiento_inventario (id, material_id, tipo, cantidad, costo_unitario, existencia_resultante,
  costo_promedio_resultante, referencia, usuario_id, creado_en)
SELECT m.id, m.material_id, m.tipo, m.cantidad, m.costo, sum(m.cantidad) OVER (PARTITION BY m.material_id ORDER BY m.creado_en, m.id),
  m.costo, m.referencia, md5('usr' || (2 + m.n % 5))::uuid, m.creado_en
FROM (
  SELECT md5('mov' || n)::uuid AS id, md5('mat' || (1 + n % 2000))::uuid AS material_id,
    CASE WHEN n <= 50000 THEN 'ENTRADA' ELSE 'CONSUMO' END::tipo_movimiento AS tipo,
    CASE WHEN n <= 50000 THEN 100 ELSE -(1 + n % 10) END::numeric AS cantidad,
    (10 + (1 + n % 2000) % 7)::numeric AS costo,
    CASE WHEN n <= 50000 THEN 'ENT-' || n END AS referencia, n,
    CASE WHEN n <= 50000 THEN now() - interval '365 days' + (n / 50000.0) * interval '165 days'
         ELSE now() - interval '200 days' + ((n - 50000) / 100000.0) * interval '200 days' END AS creado_en
  FROM generate_series(1, 150000) n
) m;

-- Un consumo_orden por cada movimiento CONSUMO, repartido entre las 15000 ordenes.
INSERT INTO consumo_orden (orden_id, material_id, movimiento_id, cantidad, costo_unitario)
SELECT md5('ord' || (1 + abs(hashtext(id::text)) % 15000))::uuid, material_id, id, -cantidad, costo_unitario
FROM movimiento_inventario WHERE tipo = 'CONSUMO';

-- Saldo del material = suma del libro. stock_minimo: 10% de materiales por encima de la existencia (alerta), el resto bajo.
UPDATE material m SET existencia = s.suma,
  stock_minimo = CASE WHEN row_number % 10 = 0 THEN s.suma * 1.5 ELSE round(s.suma * 0.1, 3) END
FROM (SELECT material_id, sum(cantidad) AS suma, row_number() OVER (ORDER BY material_id)::int AS row_number
      FROM movimiento_inventario GROUP BY material_id) s
WHERE s.material_id = m.id;

-- Bitacora (100000): 6 eventos por orden (90000) y 10000 eventos de cotizacion.
INSERT INTO bitacora (entidad, entidad_id, orden_id, accion, estado_anterior, estado_nuevo, usuario_id, creado_en)
SELECT 'ORDEN_TRABAJO', o.id, o.id, 'CAMBIAR_ESTADO', 'PENDIENTE', 'EN_PRODUCCION', md5('usr' || (1 + k % 6))::uuid,
  o.creado_en + k * interval '3 hours'
FROM orden_trabajo o CROSS JOIN generate_series(1, 6) k;

INSERT INTO bitacora (entidad, entidad_id, cotizacion_id, accion, usuario_id, creado_en)
SELECT 'COTIZACION', c.id, c.id, 'CREAR', md5('usr1')::uuid, c.creado_en
FROM cotizacion c WHERE c.numero <= 'COT-2026-010000';

RESET session_replication_role;

ANALYZE;

SELECT 'cliente' t, count(*) FROM cliente UNION ALL SELECT 'cotizacion', count(*) FROM cotizacion
UNION ALL SELECT 'item_cotizacion', count(*) FROM item_cotizacion UNION ALL SELECT 'orden_trabajo', count(*) FROM orden_trabajo
UNION ALL SELECT 'etapa_orden', count(*) FROM etapa_orden UNION ALL SELECT 'historial_etapa', count(*) FROM historial_etapa
UNION ALL SELECT 'movimiento_inventario', count(*) FROM movimiento_inventario UNION ALL SELECT 'consumo_orden', count(*) FROM consumo_orden
UNION ALL SELECT 'bitacora', count(*) FROM bitacora UNION ALL SELECT 'material', count(*) FROM material;
