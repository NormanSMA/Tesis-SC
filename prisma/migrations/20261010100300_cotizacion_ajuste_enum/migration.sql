-- ADR-014 M4a: la cotizacion admite "solicita ajustes" (secuencia 01 de la tesis v9).
-- Va sola: un valor de enum agregado no se puede usar en la misma transaccion.
ALTER TYPE "estado_cotizacion" ADD VALUE IF NOT EXISTS 'AJUSTE_SOLICITADO';
