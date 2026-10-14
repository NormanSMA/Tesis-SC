-- Impide perder el tipo de cambio de cotizaciones en dolares al revertir ADR-018.
-- cotizacion_moneda_formato nunca se elimino en la migracion de subida, por lo que no se restaura.
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
  DROP COLUMN tipo_cambio;

DELETE FROM configuracion WHERE clave = 'tipo_cambio_usd';

COMMIT;
