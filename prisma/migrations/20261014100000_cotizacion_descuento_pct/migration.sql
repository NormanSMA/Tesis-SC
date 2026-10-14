-- Descuento comercial escrito como porcentaje. El monto sigue en la columna descuento.
SET lock_timeout = '1s';
SET statement_timeout = '5s';

BEGIN;

ALTER TABLE cotizacion ADD COLUMN descuento_pct NUMERIC(5,2);
ALTER TABLE cotizacion ADD CONSTRAINT cotizacion_descuento_pct_valido
  CHECK (descuento_pct IS NULL OR (descuento_pct >= 0 AND descuento_pct <= 100)) NOT VALID;

COMMIT;

ALTER TABLE cotizacion VALIDATE CONSTRAINT cotizacion_descuento_pct_valido;
