BEGIN;

ALTER TABLE cotizacion
  ADD COLUMN mostrar_condiciones BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN tarifa VARCHAR(16) NOT NULL DEFAULT 'OCASIONAL',
  ADD COLUMN tarifa_pct NUMERIC(5, 2),
  ADD COLUMN descuento_manual BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT cotizacion_tarifa_valida CHECK (
    tarifa IN ('OCASIONAL', 'INTERMEDIA', 'PREFERENCIAL')
    AND (tarifa_pct IS NULL OR tarifa_pct BETWEEN 0 AND 100)
  );

UPDATE cotizacion
SET tasa_impuesto = 0, impuesto = 0, total = subtotal - descuento,
    actualizado_en = GREATEST(actualizado_en + interval '1 millisecond', now())
WHERE estado = 'BORRADOR' AND tasa_impuesto <> 0;

INSERT INTO configuracion (clave, tipo, valor, descripcion, actualizado_en)
VALUES ('tarifa_intermedia_pct', 'DECIMAL', '5', 'Descuento de la tarifa intermedia', now()),
       ('tarifa_preferencial_pct', 'DECIMAL', '10', 'Descuento de la tarifa preferencial', now())
ON CONFLICT (clave) DO NOTHING;

COMMIT;
