BEGIN;

CREATE TYPE area_material AS ENUM ('CORTE_LASER', 'IMPRESION_DIGITAL', 'ACABADO', 'TALLER');
ALTER TABLE material ADD COLUMN area_produccion area_material;
CREATE INDEX material_area_produccion_idx ON material(area_produccion);
ALTER TABLE consumo_estimado ADD COLUMN area_produccion area_material;

UPDATE material SET area_produccion = 'IMPRESION_DIGITAL', actualizado_en = now()
WHERE codigo ~ '^SC-LEG-0(0[1-9]|1[0-9]|2[0-2])$';
UPDATE material SET area_produccion = 'CORTE_LASER', actualizado_en = now()
WHERE codigo ~ '^SC-LEG-0(3[2-57-9]|4[0-3])$' AND codigo <> 'SC-LEG-038';
UPDATE consumo_estimado c SET area_produccion = m.area_produccion
FROM material m WHERE c.material_id = m.id AND m.area_produccion IS NOT NULL;

CREATE FUNCTION fn_orden_proteger_fecha_entrega() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fecha_entrega IS DISTINCT FROM OLD.fecha_entrega AND
    (OLD.estado IN ('LISTA', 'ENTREGADA', 'CERRADA', 'CANCELADA') OR
     NEW.estado IN ('LISTA', 'ENTREGADA', 'CERRADA', 'CANCELADA')) THEN
    RAISE EXCEPTION 'La fecha de entrega queda fija al finalizar la producción.' USING ERRCODE = 'SC007';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orden_proteger_fecha_entrega
BEFORE UPDATE OF fecha_entrega ON orden_trabajo
FOR EACH ROW EXECUTE FUNCTION fn_orden_proteger_fecha_entrega();

COMMIT;
