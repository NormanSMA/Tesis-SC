-- Auditoria de invariantes. Solo lectura: cada consulta devuelve las filas que VIOLAN la regla.
-- Ejecucion:
--   docker exec -i sc-plataforma-db-1 psql -U sc_owner -d sc_plataforma -v ON_ERROR_STOP=1 -f - < scripts/auditoria/invariantes.sql
-- Primera columna de cada consulta: id del invariante. Filas = violaciones (0 filas = cumple).

BEGIN READ ONLY;

-- INV-01: bitacora.entidad_id apunta a una fila existente de la entidad indicada (referencia polimorfica sin FK).
SELECT 'INV-01' AS inv, b.id AS bitacora_id, b.entidad, b.entidad_id, b.accion, b.creado_en
FROM bitacora b
WHERE CASE b.entidad
  WHEN 'CLIENTE' THEN NOT EXISTS (SELECT 1 FROM cliente x WHERE x.id = b.entidad_id)
  WHEN 'CATEGORIA' THEN NOT EXISTS (SELECT 1 FROM categoria x WHERE x.id = b.entidad_id)
  WHEN 'AREA' THEN NOT EXISTS (SELECT 1 FROM area x WHERE x.id = b.entidad_id)
  WHEN 'PRODUCTO' THEN NOT EXISTS (SELECT 1 FROM producto x WHERE x.id = b.entidad_id)
  WHEN 'MATERIAL' THEN NOT EXISTS (SELECT 1 FROM material x WHERE x.id = b.entidad_id)
  WHEN 'COTIZACION' THEN NOT EXISTS (SELECT 1 FROM cotizacion x WHERE x.id = b.entidad_id)
  WHEN 'ORDEN_TRABAJO' THEN NOT EXISTS (SELECT 1 FROM orden_trabajo x WHERE x.id = b.entidad_id)
  WHEN 'ETAPA_ORDEN' THEN NOT EXISTS (SELECT 1 FROM etapa_orden x WHERE x.id = b.entidad_id)
  WHEN 'MOVIMIENTO_INVENTARIO' THEN NOT EXISTS (SELECT 1 FROM movimiento_inventario x WHERE x.id = b.entidad_id)
  WHEN 'USUARIO' THEN NOT EXISTS (SELECT 1 FROM usuario x WHERE x.id = b.entidad_id)
  WHEN 'CONFIGURACION' THEN NOT EXISTS (SELECT 1 FROM configuracion x WHERE x.id = b.entidad_id)
  WHEN 'PERFIL_PERMISO' THEN NOT EXISTS (SELECT 1 FROM perfil x WHERE x.id = b.entidad_id)
                         AND NOT EXISTS (SELECT 1 FROM usuario x WHERE x.id = b.entidad_id)
  ELSE FALSE
END
ORDER BY b.creado_en;

-- INV-02: evento de etapa o de movimiento enlazado a la orden correcta (bitacora.orden_id coincide con el registro).
SELECT 'INV-02' AS inv, b.id AS bitacora_id, b.entidad, b.entidad_id, b.orden_id AS orden_bitacora,
       COALESCE(e.orden_id, c.orden_id) AS orden_real
FROM bitacora b
LEFT JOIN etapa_orden e ON b.entidad = 'ETAPA_ORDEN' AND e.id = b.entidad_id
LEFT JOIN consumo_orden c ON b.entidad = 'MOVIMIENTO_INVENTARIO' AND c.movimiento_id = b.entidad_id
WHERE (b.entidad = 'ETAPA_ORDEN' AND e.id IS NOT NULL AND b.orden_id IS DISTINCT FROM e.orden_id)
   OR (b.entidad = 'MOVIMIENTO_INVENTARIO' AND c.id IS NOT NULL AND b.orden_id IS DISTINCT FROM c.orden_id)
ORDER BY b.creado_en;

-- INV-03: etapa_orden con historial_etapa de otra orden, o historial que apunta a una etapa de otra orden.
SELECT 'INV-03' AS inv, h.id AS historial_id, h.orden_id AS orden_historial, e.orden_id AS orden_etapa, h.etapa_id
FROM historial_etapa h
JOIN etapa_orden e ON e.id = h.etapa_id
WHERE h.orden_id <> e.orden_id;

-- INV-04: material con existencia negativa.
SELECT 'INV-04' AS inv, m.id AS material_id, m.codigo, m.existencia
FROM material m
WHERE m.existencia < 0;

-- INV-05: existencia del material distinta de la suma del libro de movimientos.
SELECT 'INV-05' AS inv, m.id AS material_id, m.codigo, m.existencia,
       COALESCE(s.suma, 0) AS suma_libro, m.existencia - COALESCE(s.suma, 0) AS diferencia
FROM material m
LEFT JOIN (SELECT material_id, SUM(cantidad) AS suma FROM movimiento_inventario GROUP BY material_id) s
       ON s.material_id = m.id
WHERE m.existencia <> COALESCE(s.suma, 0)
ORDER BY m.codigo;

-- INV-06: existencia_resultante de cada movimiento distinta de la suma acumulada del libro del material.
SELECT 'INV-06' AS inv, t.id AS movimiento_id, t.material_id, t.tipo, t.cantidad,
       t.existencia_resultante, t.acumulado
FROM (
  SELECT m.*, SUM(m.cantidad) OVER (PARTITION BY m.material_id ORDER BY m.creado_en, m.id) AS acumulado
  FROM movimiento_inventario m
) t
WHERE t.existencia_resultante <> t.acumulado
ORDER BY t.creado_en;

-- INV-07: movimiento con signo incoherente con su tipo (ENTRADA y DEVOLUCION > 0, CONSUMO < 0, AJUSTE <> 0).
SELECT 'INV-07' AS inv, m.id AS movimiento_id, m.material_id, m.tipo, m.cantidad
FROM movimiento_inventario m
WHERE (m.tipo IN ('ENTRADA', 'DEVOLUCION') AND m.cantidad <= 0)
   OR (m.tipo = 'CONSUMO' AND m.cantidad >= 0)
   OR (m.tipo = 'AJUSTE' AND m.cantidad = 0);

-- INV-08: movimiento CONSUMO o DEVOLUCION sin consumo_orden (no imputado a una orden).
SELECT 'INV-08' AS inv, m.id AS movimiento_id, m.material_id, m.tipo, m.cantidad, m.creado_en
FROM movimiento_inventario m
LEFT JOIN consumo_orden c ON c.movimiento_id = m.id
WHERE m.tipo IN ('CONSUMO', 'DEVOLUCION') AND c.id IS NULL;

-- INV-09: consumo_orden cuya cantidad, costo, material o tipo de movimiento no cuadra con su movimiento.
SELECT 'INV-09' AS inv, c.id AS consumo_id, c.orden_id, c.movimiento_id, m.tipo,
       c.cantidad AS cantidad_consumo, m.cantidad AS cantidad_mov,
       c.costo_unitario AS costo_consumo, m.costo_unitario AS costo_mov
FROM consumo_orden c
JOIN movimiento_inventario m ON m.id = c.movimiento_id
WHERE c.cantidad <> ABS(m.cantidad)
   OR c.costo_unitario <> m.costo_unitario
   OR c.material_id <> m.material_id
   OR m.tipo NOT IN ('CONSUMO', 'DEVOLUCION');

-- INV-10: devolucion neta mayor que lo consumido por orden y material.
SELECT 'INV-10' AS inv, c.orden_id, c.material_id,
       SUM(CASE WHEN m.tipo = 'CONSUMO' THEN -m.cantidad ELSE 0 END) AS consumido,
       SUM(CASE WHEN m.tipo = 'DEVOLUCION' THEN m.cantidad ELSE 0 END) AS devuelto
FROM consumo_orden c
JOIN movimiento_inventario m ON m.id = c.movimiento_id
GROUP BY c.orden_id, c.material_id
HAVING SUM(CASE WHEN m.tipo = 'DEVOLUCION' THEN m.cantidad ELSE 0 END)
     > SUM(CASE WHEN m.tipo = 'CONSUMO' THEN -m.cantidad ELSE 0 END);

-- INV-11: orden LISTA con etapas PENDIENTE o EN_CURSO.
SELECT 'INV-11' AS inv, o.id AS orden_id, o.numero, o.estado,
       COUNT(*) FILTER (WHERE e.estado = 'PENDIENTE') AS pendientes,
       COUNT(*) FILTER (WHERE e.estado = 'EN_CURSO') AS en_curso
FROM orden_trabajo o
JOIN etapa_orden e ON e.orden_id = o.id AND e.estado IN ('PENDIENTE', 'EN_CURSO')
WHERE o.estado = 'LISTA'
GROUP BY o.id, o.numero, o.estado;

-- INV-12: orden ENTREGADA o CERRADA con etapas sin completar u omitir (PENDIENTE o EN_CURSO).
SELECT 'INV-12' AS inv, o.id AS orden_id, o.numero, o.estado,
       COUNT(*) FILTER (WHERE e.estado = 'PENDIENTE') AS pendientes,
       COUNT(*) FILTER (WHERE e.estado = 'EN_CURSO') AS en_curso
FROM orden_trabajo o
JOIN etapa_orden e ON e.orden_id = o.id AND e.estado IN ('PENDIENTE', 'EN_CURSO')
WHERE o.estado IN ('ENTREGADA', 'CERRADA')
GROUP BY o.id, o.numero, o.estado;

-- INV-13: orden CANCELADA con etapas EN_CURSO.
SELECT 'INV-13' AS inv, o.id AS orden_id, o.numero, o.estado, COUNT(*) AS en_curso
FROM orden_trabajo o
JOIN etapa_orden e ON e.orden_id = o.id AND e.estado = 'EN_CURSO'
WHERE o.estado = 'CANCELADA'
GROUP BY o.id, o.numero, o.estado;

-- INV-14: orden PENDIENTE con etapas iniciadas, o EN_PRODUCCION/LISTA/ENTREGADA/CERRADA sin fecha_inicio_real.
SELECT 'INV-14' AS inv, o.id AS orden_id, o.numero, o.estado, o.fecha_inicio_real,
       (SELECT COUNT(*) FROM etapa_orden e WHERE e.orden_id = o.id AND e.estado IN ('EN_CURSO', 'COMPLETADA')) AS etapas_iniciadas
FROM orden_trabajo o
WHERE (o.estado = 'PENDIENTE'
       AND EXISTS (SELECT 1 FROM etapa_orden e WHERE e.orden_id = o.id AND e.estado IN ('EN_CURSO', 'COMPLETADA')))
   OR (o.estado IN ('EN_PRODUCCION', 'LISTA', 'ENTREGADA', 'CERRADA') AND o.fecha_inicio_real IS NULL);

-- INV-15: fechas de orden incoherentes con el estado (entrega real, cierre, motivo de cancelacion).
SELECT 'INV-15' AS inv, o.id AS orden_id, o.numero, o.estado, o.fecha_entrega_real, o.fecha_cierre,
       (o.motivo_cancelacion IS NULL) AS sin_motivo
FROM orden_trabajo o
WHERE (o.estado IN ('ENTREGADA', 'CERRADA') AND o.fecha_entrega_real IS NULL)
   OR (o.estado = 'CERRADA' AND o.fecha_cierre IS NULL)
   OR (o.estado = 'CANCELADA' AND (o.motivo_cancelacion IS NULL OR btrim(o.motivo_cancelacion) = ''))
   OR (o.estado NOT IN ('ENTREGADA', 'CERRADA') AND o.fecha_entrega_real IS NOT NULL)
   OR (o.estado <> 'CERRADA' AND o.fecha_cierre IS NOT NULL);

-- INV-16: etapa EN_CURSO o COMPLETADA sin responsable o sin fecha_inicio_real; COMPLETADA sin fecha_fin_real.
SELECT 'INV-16' AS inv, e.id AS etapa_id, e.orden_id, e.secuencia, e.estado, e.responsable_id,
       e.fecha_inicio_real, e.fecha_fin_real
FROM etapa_orden e
WHERE (e.estado IN ('EN_CURSO', 'COMPLETADA') AND (e.responsable_id IS NULL OR e.fecha_inicio_real IS NULL))
   OR (e.estado = 'COMPLETADA' AND e.fecha_fin_real IS NULL)
   OR (e.estado IN ('PENDIENTE', 'OMITIDA') AND e.fecha_inicio_real IS NOT NULL);

-- INV-17: cotizacion APROBADA sin usuario_aprobacion_id, sin referencia_aprobacion o sin fecha_respuesta.
SELECT 'INV-17' AS inv, c.id AS cotizacion_id, c.numero, c.estado, c.usuario_aprobacion_id,
       c.referencia_aprobacion, c.fecha_respuesta
FROM cotizacion c
WHERE c.estado = 'APROBADA'
  AND (c.usuario_aprobacion_id IS NULL
       OR c.referencia_aprobacion IS NULL OR btrim(c.referencia_aprobacion) = ''
       OR c.fecha_respuesta IS NULL);

-- INV-18: orden cuyo cliente difiere del de su cotizacion, o cuya cotizacion no esta APROBADA.
SELECT 'INV-18' AS inv, o.id AS orden_id, o.numero, o.cliente_id AS cliente_orden,
       c.cliente_id AS cliente_cotizacion, c.numero AS cotizacion, c.estado AS estado_cotizacion
FROM orden_trabajo o
JOIN cotizacion c ON c.id = o.cotizacion_id
WHERE o.cliente_id <> c.cliente_id OR c.estado <> 'APROBADA';

-- INV-19: cotizacion cuyo subtotal difiere de la suma de importes de sus items (tolerancia 0.01; excluye BORRADOR).
SELECT 'INV-19' AS inv, c.id AS cotizacion_id, c.numero, c.estado, c.subtotal,
       COALESCE(i.suma, 0) AS suma_items, c.subtotal - COALESCE(i.suma, 0) AS diferencia
FROM cotizacion c
LEFT JOIN (SELECT cotizacion_id, SUM(importe) AS suma FROM item_cotizacion GROUP BY cotizacion_id) i
       ON i.cotizacion_id = c.id
WHERE c.estado <> 'BORRADOR'
  AND ABS(c.subtotal - COALESCE(i.suma, 0)) > 0.01;

-- INV-20: cotizacion con impuesto o total que no cumple la formula (tolerancia 0.01).
SELECT 'INV-20' AS inv, c.id AS cotizacion_id, c.numero, c.estado, c.subtotal, c.descuento, c.tasa_impuesto,
       c.impuesto, ROUND((c.subtotal - c.descuento) * c.tasa_impuesto / 100, 2) AS impuesto_esperado,
       c.total, c.subtotal - c.descuento + c.impuesto AS total_esperado
FROM cotizacion c
WHERE ABS(c.impuesto - ROUND((c.subtotal - c.descuento) * c.tasa_impuesto / 100, 2)) > 0.01
   OR ABS(c.total - (c.subtotal - c.descuento + c.impuesto)) > 0.01;

-- INV-21: item PERSONALIZADO con costo_total distinto de la suma de sus lineas de costo, o importe incoherente (tolerancia 0.01; excluye BORRADOR).
SELECT 'INV-21' AS inv, i.id AS item_id, c.numero, i.secuencia, i.costo_total,
       COALESCE(l.suma, 0) AS suma_lineas, i.importe
FROM item_cotizacion i
JOIN cotizacion c ON c.id = i.cotizacion_id
LEFT JOIN (SELECT item_id, SUM(importe) AS suma FROM linea_costo GROUP BY item_id) l ON l.item_id = i.id
WHERE c.estado <> 'BORRADOR' AND i.tipo = 'PERSONALIZADO'
  AND (ABS(COALESCE(i.costo_total, 0) - COALESCE(l.suma, 0)) > 0.01
       OR (i.margen_pct IS NOT NULL AND i.costo_total IS NOT NULL
           AND ABS(i.importe - ROUND(i.costo_total / (1 - i.margen_pct / 100), 2)) > 0.01));

-- INV-22: cambio de estado en bitacora sin estado_anterior, sin estado_nuevo, sin actor o sin cambio real.
SELECT 'INV-22' AS inv, b.id AS bitacora_id, b.entidad, b.entidad_id, b.estado_anterior, b.estado_nuevo,
       b.usuario_id, b.creado_en
FROM bitacora b
LEFT JOIN usuario u ON u.id = b.usuario_id
WHERE b.accion = 'CAMBIAR_ESTADO'
  AND (b.estado_anterior IS NULL OR btrim(b.estado_anterior) = ''
       OR b.estado_nuevo IS NULL OR btrim(b.estado_nuevo) = ''
       OR b.usuario_id IS NULL OR u.id IS NULL
       OR b.estado_anterior = b.estado_nuevo)
ORDER BY b.creado_en;

-- INV-23: estado actual de orden o cotizacion distinto del estado_nuevo de su ultimo CAMBIAR_ESTADO en bitacora.
SELECT 'INV-23' AS inv, t.entidad, t.id AS entidad_id, t.numero, t.estado AS estado_actual, u.estado_nuevo AS ultimo_en_bitacora
FROM (
  SELECT 'ORDEN_TRABAJO'::entidad_bitacora AS entidad, id, numero, estado::text AS estado FROM orden_trabajo
  UNION ALL
  SELECT 'COTIZACION'::entidad_bitacora, id, numero, estado::text FROM cotizacion
) t
JOIN LATERAL (
  SELECT b.estado_nuevo
  FROM bitacora b
  WHERE b.entidad = t.entidad AND b.entidad_id = t.id AND b.accion = 'CAMBIAR_ESTADO'
  ORDER BY b.creado_en DESC, b.id DESC
  LIMIT 1
) u ON TRUE
WHERE u.estado_nuevo <> t.estado;

-- INV-24: usuarios activos sin ningun perfil.
SELECT 'INV-24' AS inv, u.id AS usuario_id, u.correo, u.activo
FROM usuario u
WHERE u.activo
  AND NOT EXISTS (SELECT 1 FROM usuario_perfil up WHERE up.usuario_id = u.id);

-- INV-25: ningun usuario ADMIN activo (devuelve una fila si el total es 0).
SELECT 'INV-25' AS inv, 0 AS admins_activos
WHERE (
  SELECT COUNT(DISTINCT u.id)
  FROM usuario u
  JOIN usuario_perfil up ON up.usuario_id = u.id
  JOIN perfil p ON p.id = up.perfil_id
  WHERE u.activo AND p.codigo = 'ADMIN'
) = 0;

-- INV-26: orden sin etapas, o responsable de orden inactivo en orden abierta.
SELECT 'INV-26' AS inv, o.id AS orden_id, o.numero, o.estado, o.responsable_id,
       (SELECT COUNT(*) FROM etapa_orden e WHERE e.orden_id = o.id) AS etapas,
       u.activo AS responsable_activo
FROM orden_trabajo o
LEFT JOIN usuario u ON u.id = o.responsable_id
WHERE NOT EXISTS (SELECT 1 FROM etapa_orden e WHERE e.orden_id = o.id)
   OR (o.estado IN ('PENDIENTE', 'EN_PRODUCCION', 'LISTA') AND o.responsable_id IS NOT NULL AND u.activo IS NOT TRUE);

ROLLBACK;
