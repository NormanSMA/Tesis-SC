ALTER TABLE cotizacion ADD COLUMN instalacion_ida_vuelta boolean NOT NULL DEFAULT false;
ALTER TABLE cotizacion DROP CONSTRAINT cotizacion_instalacion_valida;
ALTER TABLE cotizacion ADD CONSTRAINT cotizacion_instalacion_valida CHECK (
  (instalacion_km IS NULL) = (instalacion_tarifa IS NULL)
  AND (instalacion_km IS NULL OR instalacion_km > 0)
  AND (instalacion_tarifa IS NULL OR instalacion_tarifa >= 0)
  AND instalacion_mano_obra BETWEEN 0 AND 999999999999.99
  AND instalacion_total = instalacion_mano_obra + coalesce(round(instalacion_km * instalacion_tarifa * CASE WHEN instalacion_ida_vuelta THEN 2 ELSE 1 END, 2), 0)
);
