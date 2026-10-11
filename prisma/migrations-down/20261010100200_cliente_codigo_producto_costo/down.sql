-- Los códigos de cliente y costos registrados se pierden; recuperarlos requiere el respaldo.
ALTER TABLE "producto" DROP CONSTRAINT "producto_costo_no_negativo";
ALTER TABLE "producto" DROP COLUMN "costo_unitario";
ALTER TABLE "cliente" DROP CONSTRAINT "cliente_codigo_formato";
DROP INDEX "cliente_codigo_cliente_key";
ALTER TABLE "cliente" DROP COLUMN "codigo_cliente";
DROP FUNCTION siguiente_codigo_cliente();
DROP SEQUENCE "cliente_codigo_seq";
