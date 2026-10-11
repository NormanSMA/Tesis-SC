-- ADR-014 M3: codigo_cliente (RF-01) y costo_unitario del producto (Tabla 16 de la tesis v9).
CREATE SEQUENCE "cliente_codigo_seq";

-- lpad recorta si el numero supera el ancho: el ancho minimo es 4 y crece con el numero.
CREATE OR REPLACE FUNCTION siguiente_codigo_cliente() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_n bigint := nextval('cliente_codigo_seq');
BEGIN
  RETURN 'CLI-' || lpad(v_n::text, greatest(4, length(v_n::text)), '0');
END;
$$;

ALTER TABLE "cliente" ADD COLUMN "codigo_cliente" VARCHAR(20);

UPDATE "cliente" c SET "codigo_cliente" = siguiente_codigo_cliente()
FROM (SELECT "id" FROM "cliente" ORDER BY "creado_en", "id") ordenados
WHERE ordenados."id" = c."id";

ALTER TABLE "cliente" ALTER COLUMN "codigo_cliente" SET DEFAULT siguiente_codigo_cliente();
ALTER TABLE "cliente" ALTER COLUMN "codigo_cliente" SET NOT NULL;
CREATE UNIQUE INDEX "cliente_codigo_cliente_key" ON "cliente"("codigo_cliente");
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_codigo_formato" CHECK ("codigo_cliente" ~ '^CLI-[0-9]{4,}$');

ALTER TABLE "producto" ADD COLUMN "costo_unitario" DECIMAL(14,4);
ALTER TABLE "producto" ADD CONSTRAINT "producto_costo_no_negativo" CHECK ("costo_unitario" IS NULL OR "costo_unitario" >= 0);

-- Costo de referencia: suma de la receta al costo promedio actual de cada material. Sin receta queda nulo.
UPDATE "producto" p SET "costo_unitario" = r."costo"
FROM (
  SELECT rp."producto_id", round(sum(rp."cantidad" * m."costo_promedio"), 4) AS "costo"
  FROM "receta_producto" rp JOIN "material" m ON m."id" = rp."material_id"
  GROUP BY rp."producto_id"
) r
WHERE r."producto_id" = p."id";
