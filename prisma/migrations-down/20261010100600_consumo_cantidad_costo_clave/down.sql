-- Las claves de idempotencia se pierden; recuperarlas requiere el respaldo.
-- Cantidad y costo siguen disponibles en movimiento_inventario, su fuente original.
DROP INDEX "consumo_orden_idempotency_key_material_id_key";
ALTER TABLE "consumo_orden"
  DROP COLUMN "idempotency_key",
  DROP COLUMN "costo_unitario",
  DROP COLUMN "cantidad";
