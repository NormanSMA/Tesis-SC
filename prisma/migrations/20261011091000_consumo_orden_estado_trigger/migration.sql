-- Integridad (2026-10-11, C3 parte B): fn_consumo_validar rechaza consumos segun el estado de la orden.
-- Misma regla que src/modules/inventario/consumo-calculo.ts: CONSUMO solo en PENDIENTE, EN_PRODUCCION o LISTA;
-- DEVOLUCION en cualquier estado salvo CERRADA. Expand/contract: solo reemplaza la funcion, sin cambio de esquema.
CREATE OR REPLACE FUNCTION fn_consumo_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tipo tipo_movimiento;
  v_estado estado_orden;
  v_neto numeric;
BEGIN
  SELECT tipo INTO v_tipo FROM movimiento_inventario WHERE id = NEW.movimiento_id;
  IF v_tipo NOT IN ('CONSUMO', 'DEVOLUCION') THEN
    RAISE EXCEPTION 'consumo_orden solo admite movimientos CONSUMO o DEVOLUCION, recibido %', v_tipo
      USING ERRCODE = 'SC005';
  END IF;

  SELECT estado INTO v_estado FROM orden_trabajo WHERE id = NEW.orden_id;
  IF v_tipo = 'CONSUMO' AND v_estado NOT IN ('PENDIENTE', 'EN_PRODUCCION', 'LISTA') THEN
    RAISE EXCEPTION 'La orden en estado % no admite consumo de material', v_estado
      USING ERRCODE = 'SC005';
  END IF;
  IF v_tipo = 'DEVOLUCION' AND v_estado = 'CERRADA' THEN
    RAISE EXCEPTION 'La orden en estado % no admite devolucion de material', v_estado
      USING ERRCODE = 'SC005';
  END IF;

  IF v_tipo = 'DEVOLUCION' THEN
    SELECT coalesce(-sum(m.cantidad), 0) INTO v_neto
      FROM consumo_orden c
      JOIN movimiento_inventario m ON m.id = c.movimiento_id
     WHERE c.orden_id = NEW.orden_id AND c.material_id = NEW.material_id;
    IF v_neto < 0 THEN
      RAISE EXCEPTION 'La devolucion supera lo consumido por la orden (neto %)', v_neto
        USING ERRCODE = 'SC005';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
