-- INV-12 / CAT-05: conservar UUID, costos, cantidades e instantáneas.
ALTER TABLE material ADD COLUMN codigos_anteriores text[] NOT NULL DEFAULT '{}', ADD COLUMN foto_version timestamptz(6);
ALTER TABLE producto ADD COLUMN codigos_anteriores text[] NOT NULL DEFAULT '{}';
ALTER TABLE categoria ADD COLUMN prefijo_codigo varchar(16) UNIQUE;
CREATE TABLE secuencia_codigo (clave varchar(30) PRIMARY KEY, ultimo bigint NOT NULL CHECK (ultimo >= 0));
CREATE TABLE material_foto (material_id uuid PRIMARY KEY REFERENCES material(id) ON DELETE CASCADE, contenido bytea NOT NULL CHECK (octet_length(contenido) BETWEEN 1 AND 524288));
CREATE INDEX material_codigos_anteriores_idx ON material USING gin(codigos_anteriores);
CREATE INDEX producto_codigos_anteriores_idx ON producto USING gin(codigos_anteriores);

CREATE FUNCTION prefijo_categoria(p_id uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_nombre text; v_prefijo text; v_base text; v_i integer := 1;
BEGIN
  -- Serializa únicamente la primera asignación de prefijos, incluidos los de categorías nuevas.
  SELECT prefijo_codigo, nombre INTO v_prefijo, v_nombre FROM categoria WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Categoría inexistente'; END IF;
  IF v_prefijo IS NOT NULL THEN RETURN v_prefijo; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tracore_prefijos_categoria'));
  SELECT prefijo_codigo INTO v_prefijo FROM categoria WHERE id = p_id;
  IF v_prefijo IS NOT NULL THEN RETURN v_prefijo; END IF;
  v_nombre := upper(translate(v_nombre, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'));
  v_base := CASE WHEN v_nombre LIKE 'ROTUL%' THEN 'ROT' WHEN v_nombre LIKE 'IMPRES% DIGITAL%' THEN 'ID'
    WHEN v_nombre LIKE 'DISEN%' THEN 'DG' WHEN v_nombre LIKE 'CORTE%' THEN 'GCL'
    WHEN v_nombre LIKE 'ACABADO%' THEN 'AC' WHEN v_nombre LIKE 'SUBLIM%' THEN 'SUB'
    ELSE left(regexp_replace(v_nombre, '[^A-Z0-9]', '', 'g'), 3) END;
  IF v_base = '' THEN v_base := 'CAT'; END IF;
  v_prefijo := v_base;
  WHILE EXISTS (SELECT 1 FROM categoria WHERE prefijo_codigo = v_prefijo) LOOP
    v_i := v_i + 1; v_prefijo := v_base || v_i;
  END LOOP;
  UPDATE categoria SET prefijo_codigo = v_prefijo WHERE id = p_id;
  RETURN v_prefijo;
END $$;

CREATE TEMP TABLE cambio_codigo AS
 SELECT 'MATERIAL'::text AS entidad, id, codigo AS anterior,
   (CASE area_produccion WHEN 'CORTE_LASER' THEN 'GCL' WHEN 'IMPRESION_DIGITAL' THEN 'ID'
     WHEN 'ACABADO' THEN 'AC' WHEN 'TALLER' THEN 'TA' ELSE 'SA' END) AS prefijo,
   row_number() OVER (PARTITION BY area_produccion ORDER BY creado_en, codigo, id) AS numero FROM material;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT id FROM categoria ORDER BY nombre, id LOOP PERFORM prefijo_categoria(c.id); END LOOP;
END $$;
INSERT INTO cambio_codigo SELECT 'PRODUCTO', p.id, p.codigo, 'P-' || c.prefijo_codigo,
 row_number() OVER (PARTITION BY p.categoria_id ORDER BY p.creado_en, p.codigo, p.id)
 FROM producto p JOIN categoria c ON c.id = p.categoria_id;
-- Los códigos temporales evitan colisiones al renumerar registros existentes.
UPDATE material SET codigo = '~' || left(replace(id::text, '-', ''), 28), codigos_anteriores = ARRAY[upper(codigo)];
UPDATE producto SET codigo = '~' || left(replace(id::text, '-', ''), 28), codigos_anteriores = ARRAY[upper(codigo)];
UPDATE material m SET codigo = c.prefijo || '-' || lpad(c.numero::text, greatest(3, length(c.numero::text)), '0'),
 actualizado_en = clock_timestamp() FROM cambio_codigo c WHERE c.entidad = 'MATERIAL' AND m.id = c.id;
UPDATE producto p SET codigo = c.prefijo || '-' || lpad(c.numero::text, greatest(3, length(c.numero::text)), '0'),
 actualizado_en = clock_timestamp() FROM cambio_codigo c WHERE c.entidad = 'PRODUCTO' AND p.id = c.id;
INSERT INTO secuencia_codigo SELECT prefijo, max(numero) FROM cambio_codigo GROUP BY prefijo;
-- El lote deja la correspondencia completa en la bitácora bajo la cuenta técnica existente.
INSERT INTO bitacora (id, entidad, entidad_id, accion, usuario_id, detalle)
 SELECT gen_random_uuid(), c.entidad::entidad_bitacora, c.id, 'EDITAR', u.id,
 jsonb_build_object('cambio', 'INV-12/CAT-05', 'codigoAnterior', c.anterior, 'codigoNuevo', c.prefijo || '-' || lpad(c.numero::text, greatest(3, length(c.numero::text)), '0'))
 FROM cambio_codigo c CROSS JOIN LATERAL (SELECT id FROM usuario WHERE lower(nombre) LIKE '%prueba%' ORDER BY creado_en, id LIMIT 1) u;
DROP TABLE cambio_codigo;
