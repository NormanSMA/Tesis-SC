-- Los movimientos con fecha historica (carga de demostracion) no se validan contra el estado actual de la orden.
CREATE OR REPLACE FUNCTION fn_consumo_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tipo tipo_movimiento;
  v_creado timestamptz;
  v_estado estado_orden;
  v_neto numeric;
BEGIN
  SELECT tipo, creado_en INTO v_tipo, v_creado FROM movimiento_inventario WHERE id = NEW.movimiento_id;
  IF v_tipo NOT IN ('CONSUMO', 'DEVOLUCION') THEN
    RAISE EXCEPTION 'consumo_orden solo admite movimientos CONSUMO o DEVOLUCION, recibido %', v_tipo
      USING ERRCODE = 'SC005';
  END IF;

  SELECT estado INTO v_estado FROM orden_trabajo WHERE id = NEW.orden_id;
  IF v_tipo = 'CONSUMO' AND v_creado >= now() - interval '1 hour'
     AND v_estado NOT IN ('PENDIENTE', 'EN_PRODUCCION', 'LISTA') THEN
    RAISE EXCEPTION 'La orden en estado % no admite consumo de material', v_estado
      USING ERRCODE = 'SC005';
  END IF;
  IF v_tipo = 'DEVOLUCION' AND v_creado >= now() - interval '1 hour' AND v_estado = 'CERRADA' THEN
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
