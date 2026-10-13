-- Moneda y tipo de cambio congelado por cotización (ADR-018, opción A).
BEGIN;

ALTER TABLE cotizacion
  ADD COLUMN tipo_cambio NUMERIC(10,4) NOT NULL DEFAULT 1,
  DROP CONSTRAINT IF EXISTS cotizacion_moneda_formato,
  ADD CONSTRAINT cotizacion_moneda_valida CHECK (moneda IN ('NIO', 'USD')),
  ADD CONSTRAINT cotizacion_tipo_cambio_valido CHECK (tipo_cambio > 0 AND (moneda <> 'NIO' OR tipo_cambio = 1));

INSERT INTO configuracion (clave, tipo, valor, descripcion, actualizado_en)
VALUES (
  'tipo_cambio_usd', 'DECIMAL', '36.6243',
  'Córdobas por 1 USD para cotizaciones en dólares', CURRENT_TIMESTAMP
)
ON CONFLICT (clave) DO NOTHING;

COMMIT;
