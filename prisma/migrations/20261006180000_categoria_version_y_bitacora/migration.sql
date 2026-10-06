-- Permite registrar eventos de categoria en la bitacora y versionar su edicion concurrente.
ALTER TYPE entidad_bitacora ADD VALUE IF NOT EXISTS 'CATEGORIA';
ALTER TABLE categoria ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();
