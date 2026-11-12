CREATE TYPE tipo_presentacion_material AS ENUM ('ROLLO', 'LAMINA');

ALTER TABLE material
  ADD COLUMN tipo_presentacion tipo_presentacion_material,
  ADD COLUMN ancho_presentacion NUMERIC(7, 3),
  ADD COLUMN largo_presentacion NUMERIC(7, 3),
  ADD CONSTRAINT material_presentacion_valida CHECK (
    (
      tipo_presentacion IS NULL
      AND ancho_presentacion IS NULL
      AND largo_presentacion IS NULL
    )
    OR (
      unidad = 'M2'
      AND tipo_presentacion IS NOT NULL
      AND ancho_presentacion IS NOT NULL
      AND largo_presentacion IS NOT NULL
      AND ancho_presentacion > 0
      AND ancho_presentacion <= 9999.999
      AND largo_presentacion > 0
      AND largo_presentacion <= 9999.999
    )
  );
