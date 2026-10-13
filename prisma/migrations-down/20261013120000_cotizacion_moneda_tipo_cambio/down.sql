-- Impide perder el tipo de cambio de cotizaciones en dólares al revertir ADR-018.
BEGIN;

LOCK TABLE cotizacion IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cotizacion WHERE moneda = 'USD') THEN
    RAISE EXCEPTION 'No se puede revertir ADR-018: existen cotizaciones en USD';
  END IF;
END;
$$;

ALTER TABLE cotizacion
  DROP CONSTRAINT IF EXISTS cotizacion_moneda_valida,
  DROP CONSTRAINT IF EXISTS cotizacion_tipo_cambio_valido,
  ADD CONSTRAINT cotizacion_moneda_formato CHECK (moneda ~ '^[A-Z]{3}$'),
  DROP COLUMN tipo_cambio;

DELETE FROM configuracion WHERE clave = 'tipo_cambio_usd';

COMMIT;
