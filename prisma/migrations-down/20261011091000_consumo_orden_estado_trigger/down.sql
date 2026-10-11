-- Inversa: restaura fn_consumo_validar sin la validacion del estado de la orden (version de 20261011015300).
CREATE OR REPLACE FUNCTION fn_consumo_validar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_tipo tipo_movimiento;
  v_neto numeric;
BEGIN
  SELECT tipo INTO v_tipo FROM movimiento_inventario WHERE id = NEW.movimiento_id;
  IF v_tipo NOT IN ('CONSUMO', 'DEVOLUCION') THEN
    RAISE EXCEPTION 'consumo_orden solo admite movimientos CONSUMO o DEVOLUCION, recibido %', v_tipo
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
