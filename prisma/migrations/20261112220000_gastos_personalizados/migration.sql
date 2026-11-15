ALTER TABLE item_cotizacion ADD COLUMN gastos_personalizados jsonb;
ALTER TABLE linea_costo ADD COLUMN es_gasto_personalizado boolean NOT NULL DEFAULT false;
