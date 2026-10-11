-- Eliminar historial_etapa pierde registros exclusivos; recuperarlos requiere el respaldo previo al down.
-- Conservar funciones, triggers y restricciones anteriores evita retirar invariantes ajenas a v9.
DROP TRIGGER trg_orden_inmutables ON orden_trabajo;
CREATE TRIGGER trg_orden_inmutables
  BEFORE UPDATE ON orden_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_columnas_inmutables('numero', 'cotizacion_id', 'creado_por_id', 'creado_en');

CREATE OR REPLACE FUNCTION fn_cotizacion_congelar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  c_libres CONSTANT text[] := ARRAY['estado', 'fecha_respuesta', 'motivo_rechazo', 'archivada', 'actualizado_en'];
  v_items  integer;
  v_suma   numeric;
BEGIN
  IF OLD.estado <> 'BORRADOR' THEN
    IF (to_jsonb(NEW) - c_libres) IS DISTINCT FROM (to_jsonb(OLD) - c_libres) THEN
      RAISE EXCEPTION 'Cotizacion % en estado %: solo admite cambio de estado o archivado', OLD.numero, OLD.estado
        USING ERRCODE = 'SC003';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estado <> 'BORRADOR' THEN
    SELECT count(*), coalesce(sum(importe), 0) INTO v_items, v_suma
      FROM item_cotizacion WHERE cotizacion_id = NEW.id;
    IF v_items = 0 THEN
      RAISE EXCEPTION 'Cotizacion % sin items', NEW.numero USING ERRCODE = 'SC003';
    END IF;
    IF v_suma <> NEW.subtotal THEN
      RAISE EXCEPTION 'Subtotal % no coincide con la suma de items %', NEW.subtotal, v_suma
        USING ERRCODE = 'SC003';
    END IF;
    IF EXISTS (
      SELECT 1 FROM item_cotizacion i
       WHERE i.cotizacion_id = NEW.id AND i.tipo = 'PERSONALIZADO'
         AND i.costo_total <> (SELECT coalesce(sum(l.importe), 0) FROM linea_costo l WHERE l.item_id = i.id)
    ) THEN
      RAISE EXCEPTION 'Costo de item personalizado no coincide con sus lineas de costo'
        USING ERRCODE = 'SC003';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION transicion_valida(p_maquina text, p_desde text, p_hacia text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM (VALUES
      ('cotizacion', NULL,            'BORRADOR'),
      ('cotizacion', 'BORRADOR',      'ENVIADA'),
      ('cotizacion', 'ENVIADA',       'APROBADA'),
      ('cotizacion', 'ENVIADA',       'RECHAZADA'),
      ('cotizacion', 'ENVIADA',       'VENCIDA'),
      ('orden',      NULL,            'PENDIENTE'),
      ('orden',      'PENDIENTE',     'EN_PRODUCCION'),
      ('orden',      'PENDIENTE',     'CANCELADA'),
      ('orden',      'EN_PRODUCCION', 'LISTA'),
      ('orden',      'EN_PRODUCCION', 'CANCELADA'),
      ('orden',      'LISTA',         'EN_PRODUCCION'),
      ('orden',      'LISTA',         'ENTREGADA'),
      ('orden',      'LISTA',         'CANCELADA'),
      ('orden',      'ENTREGADA',     'CERRADA'),
      ('etapa',      NULL,            'PENDIENTE'),
      ('etapa',      'PENDIENTE',     'EN_CURSO'),
      ('etapa',      'PENDIENTE',     'OMITIDA'),
      ('etapa',      'OMITIDA',       'PENDIENTE'),
      ('etapa',      'EN_CURSO',      'COMPLETADA')
    ) AS t(maquina, desde, hacia)
    WHERE t.maquina = p_maquina
      AND t.desde IS NOT DISTINCT FROM p_desde
      AND t.hacia = p_hacia
  );
$$;

DROP TRIGGER trg_consumo_copiar_movimiento ON consumo_orden;
DROP FUNCTION fn_consumo_copiar_movimiento();
DROP TRIGGER trg_historial_etapa_sin_truncate ON historial_etapa;
DROP TRIGGER trg_historial_etapa_solo_insercion ON historial_etapa;

ALTER TABLE cotizacion
  DROP CONSTRAINT cotizacion_version_valida,
  DROP CONSTRAINT cotizacion_ajuste_motivado,
  DROP CONSTRAINT cotizacion_aprobacion_registrada,
  DROP CONSTRAINT cotizacion_respuesta_fechada,
  ADD CONSTRAINT cotizacion_respuesta_fechada CHECK (
    estado NOT IN ('APROBADA', 'RECHAZADA') OR fecha_respuesta IS NOT NULL
  );

ALTER TABLE historial_etapa DROP CONSTRAINT historial_etapa_responsable_id_fkey;
ALTER TABLE historial_etapa DROP CONSTRAINT historial_etapa_usuario_id_fkey;
ALTER TABLE historial_etapa DROP CONSTRAINT historial_etapa_etapa_id_fkey;
ALTER TABLE historial_etapa DROP CONSTRAINT historial_etapa_orden_id_fkey;
DROP INDEX orden_trabajo_cotizacion_id_cliente_id_key;
DROP INDEX historial_etapa_usuario_id_idx;
DROP INDEX historial_etapa_etapa_id_creado_en_idx;
DROP INDEX historial_etapa_orden_id_creado_en_idx;
DROP TABLE historial_etapa;
ALTER TABLE orden_trabajo ADD CONSTRAINT orden_trabajo_cotizacion_id_fkey
  FOREIGN KEY (cotizacion_id) REFERENCES cotizacion(id) ON DELETE RESTRICT ON UPDATE CASCADE;
