-- Elimina el porcentaje de descuento. El monto en descuento se conserva.
BEGIN;

LOCK TABLE cotizacion IN ACCESS EXCLUSIVE MODE;

ALTER TABLE cotizacion
  DROP CONSTRAINT IF EXISTS cotizacion_descuento_pct_valido,
  DROP COLUMN IF EXISTS descuento_pct;

COMMIT;
