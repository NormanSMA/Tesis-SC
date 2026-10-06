-- Restricciones que Prisma no expresa: CHECK, triggers y funciones.
-- Aplicar despues de la migracion generada por Prisma, en la misma migracion inicial
-- (prisma migrate dev --create-only y pegar este archivo al final del migration.sql,
-- sin las lineas BEGIN y COMMIT).
-- Idempotente: se puede ejecutar varias veces sobre la misma base.
-- Documentacion: docs/analisis/05-modelo-datos.md, seccion (d).
--
-- Codigos SQLSTATE propios (el servicio los traduce a HTTP 409 con mensaje legible):
--   SC001 tabla de solo insercion
--   SC002 transicion de estado invalida
--   SC003 cotizacion congelada o incompleta
--   SC004 orden sin cotizacion aprobada
--   SC005 consumo o devolucion inconsistente
--   SC006 saldo de material modificado fuera del libro de movimientos
--   SC007 columna inmutable
-- Existencia negativa produce 23514 (check_violation) con constraint material_existencia_no_negativa.

BEGIN;

-- ===========================================================================
-- 1. CHECK por tabla
-- ===========================================================================

ALTER TABLE usuario
  DROP CONSTRAINT IF EXISTS usuario_correo_valido,
  ADD CONSTRAINT usuario_correo_valido CHECK (correo = lower(btrim(correo)) AND position('@' IN correo) > 1),
  DROP CONSTRAINT IF EXISTS usuario_intentos_no_negativos,
  ADD CONSTRAINT usuario_intentos_no_negativos CHECK (intentos_fallidos >= 0);

ALTER TABLE sesion
  DROP CONSTRAINT IF EXISTS sesion_token_hash_hex,
  ADD CONSTRAINT sesion_token_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  DROP CONSTRAINT IF EXISTS sesion_fechas_coherentes,
  ADD CONSTRAINT sesion_fechas_coherentes CHECK (expira_en > creado_en AND (revocada_en IS NULL OR revocada_en >= creado_en));

ALTER TABLE permiso
  DROP CONSTRAINT IF EXISTS permiso_formato,
  ADD CONSTRAINT permiso_formato CHECK (recurso ~ '^[a-z][a-z_]*$' AND accion ~ '^[a-z][a-z_]*$');

ALTER TABLE cliente
  DROP CONSTRAINT IF EXISTS cliente_nombre_no_vacio,
  ADD CONSTRAINT cliente_nombre_no_vacio CHECK (length(btrim(nombre)) > 0),
  DROP CONSTRAINT IF EXISTS cliente_medio_contacto,
  ADD CONSTRAINT cliente_medio_contacto CHECK (telefono IS NOT NULL OR correo IS NOT NULL),
  DROP CONSTRAINT IF EXISTS cliente_contacto_no_vacio,
  ADD CONSTRAINT cliente_contacto_no_vacio CHECK (
    (telefono IS NULL OR length(btrim(telefono)) > 0) AND (correo IS NULL OR length(btrim(correo)) > 0)
  ),
  DROP CONSTRAINT IF EXISTS cliente_correo_valido,
  ADD CONSTRAINT cliente_correo_valido CHECK (
    correo IS NULL OR (correo = lower(btrim(correo)) AND position('@' IN correo) > 1)
  );

ALTER TABLE categoria
  DROP CONSTRAINT IF EXISTS categoria_nombre_no_vacio,
  ADD CONSTRAINT categoria_nombre_no_vacio CHECK (length(btrim(nombre)) > 0);

ALTER TABLE area
  DROP CONSTRAINT IF EXISTS area_nombre_no_vacio,
  ADD CONSTRAINT area_nombre_no_vacio CHECK (length(btrim(nombre)) > 0);

ALTER TABLE producto
  DROP CONSTRAINT IF EXISTS producto_precio_no_negativo,
  ADD CONSTRAINT producto_precio_no_negativo CHECK (precio_base >= 0);

ALTER TABLE receta_producto
  DROP CONSTRAINT IF EXISTS receta_cantidad_positiva,
  ADD CONSTRAINT receta_cantidad_positiva CHECK (cantidad > 0);

ALTER TABLE material
  DROP CONSTRAINT IF EXISTS material_existencia_no_negativa,
  ADD CONSTRAINT material_existencia_no_negativa CHECK (existencia >= 0),
  DROP CONSTRAINT IF EXISTS material_costo_no_negativo,
  ADD CONSTRAINT material_costo_no_negativo CHECK (costo_promedio >= 0),
  DROP CONSTRAINT IF EXISTS material_stock_minimo_no_negativo,
  ADD CONSTRAINT material_stock_minimo_no_negativo CHECK (stock_minimo >= 0);

-- Cantidad con signo: el tipo fija el signo. AJUSTE admite ambos y exige motivo.
ALTER TABLE movimiento_inventario
  DROP CONSTRAINT IF EXISTS movimiento_signo_por_tipo,
  ADD CONSTRAINT movimiento_signo_por_tipo CHECK (
    (tipo IN ('ENTRADA', 'DEVOLUCION') AND cantidad > 0)
    OR (tipo = 'CONSUMO' AND cantidad < 0)
    OR (tipo = 'AJUSTE' AND cantidad <> 0)
  ),
  DROP CONSTRAINT IF EXISTS movimiento_ajuste_con_motivo,
  ADD CONSTRAINT movimiento_ajuste_con_motivo CHECK (tipo <> 'AJUSTE' OR length(btrim(coalesce(motivo, ''))) > 0),
  DROP CONSTRAINT IF EXISTS movimiento_valores_no_negativos,
  ADD CONSTRAINT movimiento_valores_no_negativos CHECK (
    costo_unitario >= 0 AND existencia_resultante >= 0 AND costo_promedio_resultante >= 0
  );

ALTER TABLE consumo_estimado
  DROP CONSTRAINT IF EXISTS consumo_estimado_cantidad_positiva,
  ADD CONSTRAINT consumo_estimado_cantidad_positiva CHECK (cantidad > 0);

ALTER TABLE cotizacion
  DROP CONSTRAINT IF EXISTS cotizacion_numero_formato,
  ADD CONSTRAINT cotizacion_numero_formato CHECK (numero ~ '^COT-[0-9]{4}-[0-9]{4,}$'),
  DROP CONSTRAINT IF EXISTS cotizacion_moneda_formato,
  ADD CONSTRAINT cotizacion_moneda_formato CHECK (moneda ~ '^[A-Z]{3}$'),
  DROP CONSTRAINT IF EXISTS cotizacion_porcentajes,
  ADD CONSTRAINT cotizacion_porcentajes CHECK (
    tasa_impuesto BETWEEN 0 AND 100
    AND (margen_pct IS NULL OR (margen_pct >= 0 AND margen_pct < 100))
  ),
  DROP CONSTRAINT IF EXISTS cotizacion_montos_no_negativos,
  ADD CONSTRAINT cotizacion_montos_no_negativos CHECK (
    subtotal >= 0 AND descuento >= 0 AND descuento <= subtotal AND impuesto >= 0 AND total >= 0
  ),
  DROP CONSTRAINT IF EXISTS cotizacion_aritmetica,
  ADD CONSTRAINT cotizacion_aritmetica CHECK (
    impuesto = round((subtotal - descuento) * tasa_impuesto / 100, 2)
    AND total = subtotal - descuento + impuesto
  ),
  DROP CONSTRAINT IF EXISTS cotizacion_vigencia_positiva,
  ADD CONSTRAINT cotizacion_vigencia_positiva CHECK (vigencia_dias > 0),
  DROP CONSTRAINT IF EXISTS cotizacion_fechas_por_estado,
  ADD CONSTRAINT cotizacion_fechas_por_estado CHECK (
    estado = 'BORRADOR'
    OR (fecha_emision IS NOT NULL AND fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento = fecha_emision + vigencia_dias)
  ),
  DROP CONSTRAINT IF EXISTS cotizacion_respuesta_fechada,
  ADD CONSTRAINT cotizacion_respuesta_fechada CHECK (
    estado NOT IN ('APROBADA', 'RECHAZADA') OR fecha_respuesta IS NOT NULL
  );

ALTER TABLE item_cotizacion
  DROP CONSTRAINT IF EXISTS item_valores_positivos,
  ADD CONSTRAINT item_valores_positivos CHECK (
    secuencia > 0 AND cantidad > 0 AND precio_unitario >= 0 AND importe >= 0
    AND (ancho IS NULL OR ancho > 0) AND (alto IS NULL OR alto > 0)
  ),
  DROP CONSTRAINT IF EXISTS item_medidas_m2,
  ADD CONSTRAINT item_medidas_m2 CHECK (unidad_cobro <> 'M2' OR (ancho IS NOT NULL AND alto IS NOT NULL)),
  DROP CONSTRAINT IF EXISTS item_tipo_coherente,
  ADD CONSTRAINT item_tipo_coherente CHECK (
    (tipo = 'CATALOGO' AND producto_id IS NOT NULL AND costo_total IS NULL AND margen_pct IS NULL)
    OR (tipo = 'PERSONALIZADO' AND producto_id IS NULL AND costo_total IS NOT NULL AND costo_total >= 0
        AND margen_pct IS NOT NULL AND margen_pct >= 0 AND margen_pct < 100)
  ),
  -- Solo el importe de catalogo se verifica aqui: es multiplicacion exacta.
  -- El de personalizado depende de la formula de margen (pregunta abierta P-01).
  DROP CONSTRAINT IF EXISTS item_importe_catalogo,
  ADD CONSTRAINT item_importe_catalogo CHECK (
    tipo <> 'CATALOGO'
    OR (unidad_cobro = 'UNIDAD' AND importe = round(precio_unitario * cantidad, 2))
    OR (unidad_cobro = 'M2' AND importe = round(precio_unitario * ancho * alto * cantidad, 2))
  );

ALTER TABLE linea_costo
  DROP CONSTRAINT IF EXISTS linea_valores_validos,
  ADD CONSTRAINT linea_valores_validos CHECK (
    secuencia > 0 AND cantidad > 0 AND costo_unitario >= 0 AND importe >= 0
    AND merma_pct BETWEEN 0 AND 100 AND length(btrim(unidad)) > 0
  ),
  DROP CONSTRAINT IF EXISTS linea_merma_solo_material,
  ADD CONSTRAINT linea_merma_solo_material CHECK (tipo = 'MATERIAL' OR merma_pct = 0),
  DROP CONSTRAINT IF EXISTS linea_material_solo_material,
  ADD CONSTRAINT linea_material_solo_material CHECK (material_id IS NULL OR tipo = 'MATERIAL'),
  DROP CONSTRAINT IF EXISTS linea_importe,
  ADD CONSTRAINT linea_importe CHECK (importe = round(cantidad * costo_unitario * (1 + merma_pct / 100), 2));

ALTER TABLE orden_trabajo
  DROP CONSTRAINT IF EXISTS orden_numero_formato,
  ADD CONSTRAINT orden_numero_formato CHECK (numero ~ '^OT-[0-9]{4}-[0-9]{4,}$'),
  DROP CONSTRAINT IF EXISTS orden_cancelacion_motivada,
  ADD CONSTRAINT orden_cancelacion_motivada CHECK (
    estado <> 'CANCELADA' OR length(btrim(coalesce(motivo_cancelacion, ''))) > 0
  ),
  DROP CONSTRAINT IF EXISTS orden_fechas_por_estado,
  ADD CONSTRAINT orden_fechas_por_estado CHECK (
    (estado NOT IN ('EN_PRODUCCION', 'LISTA', 'ENTREGADA', 'CERRADA') OR fecha_inicio_real IS NOT NULL)
    AND (estado NOT IN ('ENTREGADA', 'CERRADA') OR fecha_entrega_real IS NOT NULL)
    AND (estado <> 'CERRADA' OR fecha_cierre IS NOT NULL)
  ),
  DROP CONSTRAINT IF EXISTS orden_fechas_ordenadas,
  ADD CONSTRAINT orden_fechas_ordenadas CHECK (
    (fecha_entrega_real IS NULL OR fecha_inicio_real IS NULL OR fecha_entrega_real >= fecha_inicio_real)
    AND (fecha_cierre IS NULL OR fecha_entrega_real IS NULL OR fecha_cierre >= fecha_entrega_real)
  );

ALTER TABLE etapa_plantilla
  DROP CONSTRAINT IF EXISTS etapa_plantilla_secuencia_positiva,
  ADD CONSTRAINT etapa_plantilla_secuencia_positiva CHECK (secuencia > 0);

ALTER TABLE etapa_orden
  DROP CONSTRAINT IF EXISTS etapa_secuencia_positiva,
  ADD CONSTRAINT etapa_secuencia_positiva CHECK (secuencia > 0),
  DROP CONSTRAINT IF EXISTS etapa_fechas_ordenadas,
  ADD CONSTRAINT etapa_fechas_ordenadas CHECK (
    (fecha_fin_plan IS NULL OR fecha_inicio_plan IS NULL OR fecha_fin_plan >= fecha_inicio_plan)
    AND (fecha_fin_real IS NULL OR fecha_inicio_real IS NULL OR fecha_fin_real >= fecha_inicio_real)
  ),
  DROP CONSTRAINT IF EXISTS etapa_fechas_por_estado,
  ADD CONSTRAINT etapa_fechas_por_estado CHECK (
    (estado IN ('PENDIENTE', 'OMITIDA') AND fecha_inicio_real IS NULL AND fecha_fin_real IS NULL)
    OR (estado = 'EN_CURSO' AND fecha_inicio_real IS NOT NULL AND fecha_fin_real IS NULL AND responsable_id IS NOT NULL)
    OR (estado = 'COMPLETADA' AND fecha_inicio_real IS NOT NULL AND fecha_fin_real IS NOT NULL AND responsable_id IS NOT NULL)
  );

ALTER TABLE bitacora
  DROP CONSTRAINT IF EXISTS bitacora_estado_en_cambio,
  ADD CONSTRAINT bitacora_estado_en_cambio CHECK (accion <> 'CAMBIAR_ESTADO' OR estado_nuevo IS NOT NULL),
  DROP CONSTRAINT IF EXISTS bitacora_enlace_orden,
  ADD CONSTRAINT bitacora_enlace_orden CHECK (
    -- IS NOT DISTINCT FROM: con "=" un orden_id NULL daria NULL y el CHECK lo aceptaria.
    (entidad <> 'ORDEN_TRABAJO' OR orden_id IS NOT DISTINCT FROM entidad_id)
    AND (entidad <> 'ETAPA_ORDEN' OR orden_id IS NOT NULL)
    AND (accion NOT IN ('CONSUMIR_MATERIAL', 'DEVOLVER_MATERIAL', 'CONVERTIR_EN_ORDEN') OR orden_id IS NOT NULL)
  ),
  DROP CONSTRAINT IF EXISTS bitacora_enlace_cotizacion,
  ADD CONSTRAINT bitacora_enlace_cotizacion CHECK (
    (entidad <> 'COTIZACION' OR cotizacion_id IS NOT DISTINCT FROM entidad_id)
    AND (accion <> 'CONVERTIR_EN_ORDEN' OR cotizacion_id IS NOT NULL)
  ),
  DROP CONSTRAINT IF EXISTS bitacora_detalle_objeto,
  ADD CONSTRAINT bitacora_detalle_objeto CHECK (jsonb_typeof(detalle) = 'object');

ALTER TABLE configuracion
  DROP CONSTRAINT IF EXISTS configuracion_clave_formato,
  ADD CONSTRAINT configuracion_clave_formato CHECK (clave ~ '^[a-z][a-z0-9_]*$'),
  DROP CONSTRAINT IF EXISTS configuracion_valor_tipado,
  ADD CONSTRAINT configuracion_valor_tipado CHECK (
    (tipo = 'TEXTO')
    OR (tipo = 'ENTERO' AND valor ~ '^-?[0-9]+$')
    OR (tipo = 'DECIMAL' AND valor ~ '^-?[0-9]+(\.[0-9]+)?$')
    OR (tipo = 'BOOLEANO' AND valor IN ('true', 'false'))
  );

ALTER TABLE contador
  DROP CONSTRAINT IF EXISTS contador_valores,
  ADD CONSTRAINT contador_valores CHECK (anio BETWEEN 2000 AND 9999 AND ultimo >= 0);

-- ===========================================================================
-- 2. Tablas de solo insercion: bitacora, movimiento_inventario, consumo_orden
-- ===========================================================================

CREATE OR REPLACE FUNCTION fn_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo insercion: % no permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'SC001';
END;
$$;

DROP TRIGGER IF EXISTS trg_bitacora_solo_insercion ON bitacora;
CREATE TRIGGER trg_bitacora_solo_insercion
  BEFORE UPDATE OR DELETE ON bitacora
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_bitacora_sin_truncate ON bitacora;
CREATE TRIGGER trg_bitacora_sin_truncate
  BEFORE TRUNCATE ON bitacora
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_movimiento_solo_insercion ON movimiento_inventario;
CREATE TRIGGER trg_movimiento_solo_insercion
  BEFORE UPDATE OR DELETE ON movimiento_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_movimiento_sin_truncate ON movimiento_inventario;
CREATE TRIGGER trg_movimiento_sin_truncate
  BEFORE TRUNCATE ON movimiento_inventario
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_consumo_solo_insercion ON consumo_orden;
CREATE TRIGGER trg_consumo_solo_insercion
  BEFORE UPDATE OR DELETE ON consumo_orden
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_consumo_sin_truncate ON consumo_orden;
CREATE TRIGGER trg_consumo_sin_truncate
  BEFORE TRUNCATE ON consumo_orden
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_solicitud_solo_insercion ON solicitud_idempotente;
CREATE TRIGGER trg_solicitud_solo_insercion
  BEFORE UPDATE OR DELETE ON solicitud_idempotente
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_solicitud_sin_truncate ON solicitud_idempotente;
CREATE TRIGGER trg_solicitud_sin_truncate
  BEFORE TRUNCATE ON solicitud_idempotente
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();

-- ===========================================================================
-- 3. Libro de inventario: el movimiento actualiza el saldo del material
-- ===========================================================================

-- Unico camino de escritura de material.existencia y material.costo_promedio.
-- El UPDATE toma el bloqueo de fila del material: consumos concurrentes se serializan
-- y el segundo ve el saldo ya descontado. Si el saldo queda negativo, el CHECK
-- material_existencia_no_negativa aborta la transaccion completa.
CREATE OR REPLACE FUNCTION fn_movimiento_aplicar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_existencia numeric;
  v_costo      numeric;
  v_nueva      numeric;
BEGIN
  SELECT existencia, costo_promedio INTO v_existencia, v_costo
    FROM material WHERE id = NEW.material_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material % no existe', NEW.material_id USING ERRCODE = '23503';
  END IF;

  -- Solo la ENTRADA trae costo propio. El resto se valora al costo promedio vigente.
  IF NEW.tipo <> 'ENTRADA' THEN
    NEW.costo_unitario := v_costo;
  END IF;

  v_nueva := v_existencia + NEW.cantidad;

  IF NEW.tipo = 'ENTRADA' THEN
    v_costo := round((v_existencia * v_costo + NEW.cantidad * NEW.costo_unitario) / v_nueva, 4);
  END IF;

  UPDATE material SET existencia = v_nueva, costo_promedio = v_costo WHERE id = NEW.material_id;

  NEW.existencia_resultante := v_nueva;
  NEW.costo_promedio_resultante := v_costo;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimiento_aplicar ON movimiento_inventario;
CREATE TRIGGER trg_movimiento_aplicar
  BEFORE INSERT ON movimiento_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_movimiento_aplicar();

-- Impide escribir el saldo fuera del libro. pg_trigger_depth() = 2 solo dentro de fn_movimiento_aplicar.
-- costo_promedio se puede fijar a mano mientras no haya existencia (precio de referencia para cotizar).
CREATE OR REPLACE FUNCTION fn_material_proteger_saldo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.existencia <> 0 THEN
      RAISE EXCEPTION 'La existencia inicial se registra con un movimiento ENTRADA'
        USING ERRCODE = 'SC006';
    END IF;
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() < 2 THEN
    IF NEW.existencia IS DISTINCT FROM OLD.existencia THEN
      RAISE EXCEPTION 'material.existencia solo cambia mediante movimiento_inventario'
        USING ERRCODE = 'SC006';
    END IF;
    IF NEW.costo_promedio IS DISTINCT FROM OLD.costo_promedio AND OLD.existencia <> 0 THEN
      RAISE EXCEPTION 'material.costo_promedio solo cambia mediante ENTRADA cuando hay existencia'
        USING ERRCODE = 'SC006';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_material_proteger_saldo ON material;
CREATE TRIGGER trg_material_proteger_saldo
  BEFORE INSERT OR UPDATE ON material
  FOR EACH ROW EXECUTE FUNCTION fn_material_proteger_saldo();

-- Todo CONSUMO o DEVOLUCION debe quedar ligado a una orden al confirmar la transaccion (CF-03 con CF-04).
CREATE OR REPLACE FUNCTION fn_movimiento_exige_consumo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo IN ('CONSUMO', 'DEVOLUCION')
     AND NOT EXISTS (SELECT 1 FROM consumo_orden WHERE movimiento_id = NEW.id) THEN
    RAISE EXCEPTION 'Movimiento % de tipo % sin consumo_orden asociado', NEW.id, NEW.tipo
      USING ERRCODE = 'SC005';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimiento_exige_consumo ON movimiento_inventario;
CREATE CONSTRAINT TRIGGER trg_movimiento_exige_consumo
  AFTER INSERT ON movimiento_inventario
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_movimiento_exige_consumo();

-- consumo_orden solo apunta a CONSUMO o DEVOLUCION, y lo devuelto no supera lo consumido
-- por la misma orden y material. El bloqueo de fila del material serializa la verificacion.
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

DROP TRIGGER IF EXISTS trg_consumo_validar ON consumo_orden;
CREATE TRIGGER trg_consumo_validar
  AFTER INSERT ON consumo_orden
  FOR EACH ROW EXECUTE FUNCTION fn_consumo_validar();

-- ===========================================================================
-- 4. Maquinas de estado
-- ===========================================================================

-- Fuente unica de transiciones en la base. src/core/estados.ts debe coincidir;
-- una prueba recorre todos los pares y compara con esta funcion.
-- desde = NULL representa el estado inicial al insertar.
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

CREATE OR REPLACE FUNCTION fn_validar_transicion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_maquina text := TG_ARGV[0];
  v_desde   text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.estado = OLD.estado THEN
      RETURN NEW;
    END IF;
    v_desde := OLD.estado::text;
  END IF;

  IF NOT transicion_valida(v_maquina, v_desde, NEW.estado::text) THEN
    RAISE EXCEPTION 'Transicion invalida en %: % -> %', v_maquina, coalesce(v_desde, '(alta)'), NEW.estado
      USING ERRCODE = 'SC002';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizacion_transicion ON cotizacion;
CREATE TRIGGER trg_cotizacion_transicion
  BEFORE INSERT OR UPDATE OF estado ON cotizacion
  FOR EACH ROW EXECUTE FUNCTION fn_validar_transicion('cotizacion');

DROP TRIGGER IF EXISTS trg_orden_transicion ON orden_trabajo;
CREATE TRIGGER trg_orden_transicion
  BEFORE INSERT OR UPDATE OF estado ON orden_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_validar_transicion('orden');

DROP TRIGGER IF EXISTS trg_etapa_transicion ON etapa_orden;
CREATE TRIGGER trg_etapa_transicion
  BEFORE INSERT OR UPDATE OF estado ON etapa_orden
  FOR EACH ROW EXECUTE FUNCTION fn_validar_transicion('etapa');

-- ===========================================================================
-- 5. Cotizacion: snapshot congelado fuera de BORRADOR (base de CF-01 y CF-09)
-- ===========================================================================

-- Fuera de BORRADOR solo cambian estado, respuesta y archivado.
-- Al salir de BORRADOR se verifica que haya items y que los totales cuadren con ellos.
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

DROP TRIGGER IF EXISTS trg_cotizacion_congelar ON cotizacion;
CREATE TRIGGER trg_cotizacion_congelar
  BEFORE UPDATE ON cotizacion
  FOR EACH ROW EXECUTE FUNCTION fn_cotizacion_congelar();

-- Items y lineas solo se escriben con la cotizacion en BORRADOR.
-- FOR SHARE bloquea el cambio de estado concurrente hasta que termine la escritura del item.
CREATE OR REPLACE FUNCTION fn_cotizacion_estado_de_item(p_item_id uuid) RETURNS estado_cotizacion
LANGUAGE sql AS $$
  SELECT c.estado FROM cotizacion c
    JOIN item_cotizacion i ON i.cotizacion_id = c.id
   WHERE i.id = p_item_id
   FOR SHARE OF c;
$$;

CREATE OR REPLACE FUNCTION fn_item_exige_borrador() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_estado estado_cotizacion;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT estado INTO v_estado FROM cotizacion WHERE id = OLD.cotizacion_id FOR SHARE;
    IF v_estado <> 'BORRADOR' THEN
      RAISE EXCEPTION 'Items de cotizacion en estado % no se modifican', v_estado USING ERRCODE = 'SC003';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT estado INTO v_estado FROM cotizacion WHERE id = NEW.cotizacion_id FOR SHARE;
    IF v_estado <> 'BORRADOR' THEN
      RAISE EXCEPTION 'Items de cotizacion en estado % no se modifican', v_estado USING ERRCODE = 'SC003';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_exige_borrador ON item_cotizacion;
CREATE TRIGGER trg_item_exige_borrador
  BEFORE INSERT OR UPDATE OR DELETE ON item_cotizacion
  FOR EACH ROW EXECUTE FUNCTION fn_item_exige_borrador();

CREATE OR REPLACE FUNCTION fn_linea_exige_borrador() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_estado estado_cotizacion;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_estado := fn_cotizacion_estado_de_item(OLD.item_id);
    IF v_estado <> 'BORRADOR' THEN
      RAISE EXCEPTION 'Lineas de costo de cotizacion en estado % no se modifican', v_estado USING ERRCODE = 'SC003';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_estado := fn_cotizacion_estado_de_item(NEW.item_id);
    IF v_estado <> 'BORRADOR' THEN
      RAISE EXCEPTION 'Lineas de costo de cotizacion en estado % no se modifican', v_estado USING ERRCODE = 'SC003';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_linea_exige_borrador ON linea_costo;
CREATE TRIGGER trg_linea_exige_borrador
  BEFORE INSERT OR UPDATE OR DELETE ON linea_costo
  FOR EACH ROW EXECUTE FUNCTION fn_linea_exige_borrador();

-- ===========================================================================
-- 6. Orden de trabajo: nace de una cotizacion APROBADA (CF-01)
-- ===========================================================================

-- APROBADA es estado terminal: no hay carrera posible entre esta lectura y el commit.
CREATE OR REPLACE FUNCTION fn_orden_exige_aprobada() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_estado estado_cotizacion;
BEGIN
  SELECT estado INTO v_estado FROM cotizacion WHERE id = NEW.cotizacion_id;
  IF v_estado IS DISTINCT FROM 'APROBADA' THEN
    RAISE EXCEPTION 'La orden requiere cotizacion APROBADA (estado actual: %)', coalesce(v_estado::text, 'inexistente')
      USING ERRCODE = 'SC004';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orden_exige_aprobada ON orden_trabajo;
CREATE TRIGGER trg_orden_exige_aprobada
  BEFORE INSERT ON orden_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_orden_exige_aprobada();

-- ===========================================================================
-- 7. Columnas inmutables despues del alta
-- ===========================================================================

CREATE OR REPLACE FUNCTION fn_columnas_inmutables() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_col text;
BEGIN
  FOREACH v_col IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) -> v_col) IS DISTINCT FROM (to_jsonb(OLD) -> v_col) THEN
      RAISE EXCEPTION 'La columna %.% es inmutable', TG_TABLE_NAME, v_col USING ERRCODE = 'SC007';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orden_inmutables ON orden_trabajo;
CREATE TRIGGER trg_orden_inmutables
  BEFORE UPDATE ON orden_trabajo
  FOR EACH ROW EXECUTE FUNCTION fn_columnas_inmutables('numero', 'cotizacion_id', 'creado_por_id', 'creado_en');

DROP TRIGGER IF EXISTS trg_cotizacion_inmutables ON cotizacion;
CREATE TRIGGER trg_cotizacion_inmutables
  BEFORE UPDATE ON cotizacion
  FOR EACH ROW EXECUTE FUNCTION fn_columnas_inmutables('numero', 'creado_por_id', 'creado_en');

DROP TRIGGER IF EXISTS trg_etapa_inmutables ON etapa_orden;
CREATE TRIGGER trg_etapa_inmutables
  BEFORE UPDATE ON etapa_orden
  FOR EACH ROW EXECUTE FUNCTION fn_columnas_inmutables('orden_id', 'creado_en');

-- ===========================================================================
-- 8. Numeracion legible sin huecos
-- ===========================================================================

-- Llamar dentro de la transaccion que inserta el documento:
--   SELECT siguiente_numero('COTIZACION');  -> COT-2026-0001
-- El UPSERT bloquea la fila (tipo, anio) hasta el commit. Un rollback devuelve el numero.
-- El anio se toma en America/Managua para que el 31 de diciembre local no salte de anio.
CREATE OR REPLACE FUNCTION siguiente_numero(p_tipo tipo_documento, p_momento timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_anio integer := extract(year FROM p_momento AT TIME ZONE 'America/Managua')::integer;
  v_n    integer;
BEGIN
  INSERT INTO contador (tipo, anio, ultimo) VALUES (p_tipo, v_anio, 1)
  ON CONFLICT (tipo, anio) DO UPDATE SET ultimo = contador.ultimo + 1
  RETURNING ultimo INTO v_n;

  RETURN CASE p_tipo WHEN 'COTIZACION' THEN 'COT' ELSE 'OT' END
         || '-' || v_anio
         || '-' || lpad(v_n::text, greatest(4, length(v_n::text)), '0');
END;
$$;

COMMIT;
