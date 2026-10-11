-- ADR-014 M6: consumo con cantidad, costo e idempotency_key propios (Tabla 16 de la tesis v9).
-- La cantidad es positiva (valor absoluto del movimiento). El tipo CONSUMO o DEVOLUCION sigue en el movimiento.
ALTER TABLE "consumo_orden"
  ADD COLUMN "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN "costo_unitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN "idempotency_key" UUID;

ALTER TABLE "consumo_orden" DISABLE TRIGGER "trg_consumo_solo_insercion";
UPDATE "consumo_orden" c SET "cantidad" = abs(m."cantidad"), "costo_unitario" = m."costo_unitario"
FROM "movimiento_inventario" m WHERE m."id" = c."movimiento_id";
ALTER TABLE "consumo_orden" ENABLE TRIGGER "trg_consumo_solo_insercion";

-- Una clave por material: una solicitud con varios materiales reutiliza la misma clave.
CREATE UNIQUE INDEX "consumo_orden_idempotency_key_material_id_key" ON "consumo_orden"("idempotency_key", "material_id");
