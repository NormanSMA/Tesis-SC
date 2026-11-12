BEGIN;

ALTER TABLE etapa_orden ADD COLUMN instrucciones TEXT;
INSERT INTO area (nombre) VALUES ('Bordado y Serigrafía') ON CONFLICT (nombre) DO NOTHING;

INSERT INTO categoria (nombre) VALUES
  ('Marketing digital'), ('Impresión UV-DTF'), ('Impresión digital a gran formato'),
  ('Rotulación'), ('Corte y grabado láser'), ('Bordado computarizado'),
  ('Letras corpóreas'), ('Sublimación y serigrafía'), ('Muebles metálicos y melamina'),
  ('Renta y fabricación de vallas'), ('Señalización vial y empresarial'),
  ('Reconocimientos empresariales y deportivos'), ('Video marketing')
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE material
  ADD COLUMN unidad_cotizacion unidad_material,
  ADD COLUMN area_unidad_inventario NUMERIC(14,6),
  ADD COLUMN precio_cotizacion NUMERIC(14,4),
  ADD CONSTRAINT material_precio_cotizacion CHECK (precio_cotizacion BETWEEN 0 AND 9999999999.9999),
  ADD CONSTRAINT material_unidad_cotizacion CHECK (
    (area_unidad_inventario IS NULL AND (unidad_cotizacion IS NULL OR unidad_cotizacion = unidad))
    OR (area_unidad_inventario > 0 AND area_unidad_inventario <= 99999999.999999
      AND unidad_cotizacion IS NOT DISTINCT FROM 'M2'::unidad_material AND unidad IN ('PLIEGO', 'ROLLO'))
  );

UPDATE material SET unidad_cotizacion = 'M2' WHERE unidad = 'M2';

ALTER TABLE linea_costo
  ADD COLUMN cantidad_por_area BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN area_unidad_inventario NUMERIC(14,6);

ALTER TABLE cotizacion
  ADD COLUMN instalacion_km NUMERIC(9,3),
  ADD COLUMN instalacion_tarifa NUMERIC(12,2),
  ADD COLUMN instalacion_mano_obra NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN instalacion_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN instalacion_destino VARCHAR(120),
  DROP CONSTRAINT cotizacion_aritmetica,
  ADD CONSTRAINT cotizacion_instalacion_valida CHECK (
    (instalacion_km IS NULL) = (instalacion_tarifa IS NULL)
    AND (instalacion_km IS NULL OR instalacion_km BETWEEN 0.001 AND 999999.999)
    AND (instalacion_tarifa IS NULL OR instalacion_tarifa BETWEEN 0 AND 9999999999.99)
    AND instalacion_mano_obra BETWEEN 0 AND 999999999999.99
    AND instalacion_total = instalacion_mano_obra + coalesce(round(instalacion_km * instalacion_tarifa, 2), 0)
  ),
  ADD CONSTRAINT cotizacion_aritmetica CHECK (
    impuesto = round((subtotal - descuento) * tasa_impuesto / 100, 2)
    AND total = subtotal - descuento + impuesto + instalacion_total
  );

INSERT INTO configuracion (clave, tipo, valor, descripcion, actualizado_en) VALUES
  ('tarifa_instalacion_km', 'DECIMAL', '20', 'Tarifa en córdobas por kilómetro de ida desde el centro de Estelí.', now()),
  ('tarifa_ocasional_pct', 'DECIMAL', '0', 'Descuento de la tarifa ocasional.', now())
ON CONFLICT (clave) DO NOTHING;

INSERT INTO permiso (recurso, accion, descripcion) VALUES ('tarifa', 'gestionar', 'Gestionar tarifas comerciales')
ON CONFLICT (recurso, accion) DO NOTHING;
INSERT INTO perfil_permiso (perfil_id, permiso_id)
SELECT perfil.id, permiso.id FROM perfil CROSS JOIN permiso
WHERE perfil.codigo IN ('GERENCIA', 'ADMINISTRACION') AND permiso.recurso = 'tarifa' AND permiso.accion = 'gestionar'
ON CONFLICT DO NOTHING;

COMMIT;
