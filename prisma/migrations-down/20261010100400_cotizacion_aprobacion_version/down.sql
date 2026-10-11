-- La aprobación, versión y motivo de ajuste se pierden; recuperarlos requiere el respaldo.
ALTER TABLE "cotizacion" DROP CONSTRAINT "cotizacion_usuario_aprobacion_id_fkey";
DROP INDEX "cotizacion_usuario_aprobacion_id_idx";
ALTER TABLE "cotizacion"
  DROP COLUMN "motivo_ajuste",
  DROP COLUMN "version",
  DROP COLUMN "referencia_aprobacion",
  DROP COLUMN "usuario_aprobacion_id";
