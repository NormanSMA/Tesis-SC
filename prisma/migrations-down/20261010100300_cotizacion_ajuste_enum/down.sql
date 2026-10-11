-- PostgreSQL no permite eliminar valores de enum mediante ALTER TYPE.
-- AJUSTE_SOLICITADO permanece; restaurar el respaldo anterior permite eliminarlo.
-- Resolver cotizaciones con ese estado antes de arrancar código anterior.
DO $advertencia$
BEGIN
  RAISE NOTICE 'Reversión parcial: AJUSTE_SOLICITADO permanece en estado_cotizacion';
END;
$advertencia$;
