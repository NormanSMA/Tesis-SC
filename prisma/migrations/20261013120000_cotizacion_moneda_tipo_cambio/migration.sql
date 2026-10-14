-- Moneda y tipo de cambio congelado por cotizacion (ADR-018, opcion A).
-- El CHECK antiguo cotizacion_moneda_formato (tres letras mayusculas) se conserva: NIO y USD lo cumplen.
SET lock_timeout = '1s';
SET statement_timeout = '5s';

BEGIN;

ALTER TABLE cotizacion ADD COLUMN tipo_cambio NUMERIC(10,4) NOT NULL DEFAULT 1;
ALTER TABLE cotizacion ADD CONSTRAINT cotizacion_moneda_valida CHECK (moneda IN ('NIO', 'USD')) NOT VALID;
ALTER TABLE cotizacion ADD CONSTRAINT cotizacion_tipo_cambio_valido
  CHECK (tipo_cambio > 0 AND (moneda <> 'NIO' OR tipo_cambio = 1)) NOT VALID;

COMMIT;

ALTER TABLE cotizacion VALIDATE CONSTRAINT cotizacion_moneda_valida;
ALTER TABLE cotizacion VALIDATE CONSTRAINT cotizacion_tipo_cambio_valido;

INSERT INTO configuracion (clave, tipo, valor, descripcion, actualizado_en)
VALUES (
  'tipo_cambio_usd', 'DECIMAL', '36.6243',
  'Córdobas por 1 USD para cotizaciones en dólares', CURRENT_TIMESTAMP
)
ON CONFLICT (clave) DO NOTHING;
