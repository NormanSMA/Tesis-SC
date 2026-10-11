-- ADR-014 M5: orden con cliente_id propio (Tabla 16) y responsable opcional (secuencia 01 de la tesis v9).
ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_id_cliente_id_key" UNIQUE ("id", "cliente_id");

ALTER TABLE "orden_trabajo" ADD COLUMN "cliente_id" UUID;
UPDATE "orden_trabajo" o SET "cliente_id" = c."cliente_id" FROM "cotizacion" c WHERE c."id" = o."cotizacion_id";
ALTER TABLE "orden_trabajo" ALTER COLUMN "cliente_id" SET NOT NULL;

ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- La clave compuesta garantiza que el cliente de la orden es el de su cotizacion.
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "orden_trabajo_cotizacion_id_cliente_id_fkey"
  FOREIGN KEY ("cotizacion_id", "cliente_id") REFERENCES "cotizacion"("id", "cliente_id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "orden_trabajo_cliente_id_idx" ON "orden_trabajo"("cliente_id");

ALTER TABLE "orden_trabajo" ALTER COLUMN "responsable_id" DROP NOT NULL;
