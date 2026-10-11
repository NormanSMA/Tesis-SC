-- Eliminar cliente_id pierde su copia; cotizacion.cliente_id conserva la referencia original.
-- Asignar responsables explícitamente si existen órdenes sin responsable; no inferirlos.
DO $comprobar$
BEGIN
  IF EXISTS (SELECT 1 FROM "orden_trabajo" WHERE "responsable_id" IS NULL) THEN
    RAISE EXCEPTION 'Asigne responsables a todas las órdenes antes de revertir esta migración';
  END IF;
END;
$comprobar$;

ALTER TABLE "orden_trabajo" ALTER COLUMN "responsable_id" SET NOT NULL;
DROP INDEX "orden_trabajo_cliente_id_idx";
ALTER TABLE "orden_trabajo" DROP CONSTRAINT "orden_trabajo_cotizacion_id_cliente_id_fkey";
ALTER TABLE "orden_trabajo" DROP CONSTRAINT "orden_trabajo_cliente_id_fkey";
ALTER TABLE "orden_trabajo" DROP COLUMN "cliente_id";
ALTER TABLE "cotizacion" DROP CONSTRAINT "cotizacion_id_cliente_id_key";
