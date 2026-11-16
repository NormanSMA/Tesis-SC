-- Tercera medida opcional de las partidas. Con profundidad, el m² se cobra como caja abierta:
-- ancho × alto + 2 × profundidad × (ancho + alto). Las partidas existentes no tienen profundidad y conservan su importe.
ALTER TABLE item_cotizacion ADD COLUMN profundidad DECIMAL(14,3);

ALTER TABLE item_cotizacion
  DROP CONSTRAINT IF EXISTS item_valores_positivos,
  ADD CONSTRAINT item_valores_positivos CHECK (
    secuencia > 0 AND cantidad > 0 AND precio_unitario >= 0 AND importe >= 0
    AND (ancho IS NULL OR ancho > 0) AND (alto IS NULL OR alto > 0)
    AND (profundidad IS NULL OR profundidad > 0)
  ),
  DROP CONSTRAINT IF EXISTS item_importe_catalogo,
  ADD CONSTRAINT item_importe_catalogo CHECK (
    tipo <> 'CATALOGO'
    OR (unidad_cobro = 'UNIDAD' AND importe = round(precio_unitario * cantidad, 2))
    OR (unidad_cobro = 'M2' AND importe = round(precio_unitario
        * (ancho * alto + 2 * coalesce(profundidad, 0) * (ancho + alto)) * cantidad, 2))
  );
