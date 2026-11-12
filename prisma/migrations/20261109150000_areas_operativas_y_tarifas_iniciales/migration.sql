BEGIN;

CREATE TEMP TABLE nombres_area (
  anterior text PRIMARY KEY, oficial text NOT NULL, renombrar boolean NOT NULL
) ON COMMIT DROP;
INSERT INTO nombres_area VALUES
  ('Diseño y artes gráficas', 'Diseño Gráfico', true),
  ('Corte y láser', 'Grabado y Corte Láser', true),
  ('Impresión', 'Impresión Digital', true),
  ('Acabados', 'Acabado', true),
  ('Carpintería y metalmecánica', 'Taller', true),
  ('Despacho', 'Acabado', false),
  ('Instalación', 'Acabado', false),
  ('Electricidad y LED', 'Taller', false);

UPDATE area a SET nombre = n.oficial, actualizado_en = now()
FROM nombres_area n WHERE a.nombre = n.anterior AND n.renombrar
  AND NOT EXISTS (SELECT 1 FROM area vigente WHERE vigente.nombre = n.oficial);

INSERT INTO area (nombre)
SELECT DISTINCT oficial FROM nombres_area ON CONFLICT (nombre) DO NOTHING;
INSERT INTO area (nombre) VALUES ('Bordado y Serigrafía') ON CONFLICT (nombre) DO NOTHING;

CREATE TEMP TABLE reasignar_area ON COMMIT DROP AS
SELECT anterior.id AS origen, oficial.id AS destino
FROM nombres_area n
JOIN area anterior ON anterior.nombre = n.anterior
JOIN area oficial ON oficial.nombre = n.oficial;

UPDATE etapa_orden e SET area_id = r.destino, actualizado_en = now()
FROM reasignar_area r WHERE e.area_id = r.origen;
UPDATE etapa_plantilla p SET area_id = r.destino, actualizado_en = now()
FROM reasignar_area r WHERE p.area_id = r.origen;
INSERT INTO usuario_area (usuario_id, area_id)
SELECT u.usuario_id, r.destino FROM usuario_area u
JOIN reasignar_area r ON u.area_id = r.origen ON CONFLICT DO NOTHING;
DELETE FROM usuario_area u USING reasignar_area r WHERE u.area_id = r.origen;
UPDATE area a SET activo = false, actualizado_en = now()
FROM reasignar_area r WHERE a.id = r.origen;

-- Precios de cotización provisionales en C$. Los valores positivos ya configurados tienen prioridad.
WITH tarifas(numero, precio) AS (VALUES
  (1, 85), (2, 340), (3, 265), (4, 150), (5, 115), (6, 225),
  (7, 255), (8, 295), (9, 165), (10, 280), (11, 690), (12, 170),
  (13, 185), (14, 195), (15, 210), (16, 325), (17, 980), (18, 580),
  (19, 480), (20, 195), (21, 275), (22, 180), (23, 9), (24, 30),
  (25, 38), (26, 24), (27, 18), (28, 24), (29, 13), (30, 17),
  (31, 11), (32, 1200), (33, 110), (34, 850), (35, 290), (36, 420),
  (37, 520), (38, 680), (39, 345), (40, 980), (41, 1380), (42, 1480), (43, 1320)
)
UPDATE material m SET precio_cotizacion = t.precio, actualizado_en = now()
FROM tarifas t WHERE m.codigo = 'SC-LEG-' || lpad(t.numero::text, 3, '0')
  AND m.activo AND (m.precio_cotizacion IS NULL OR m.precio_cotizacion = 0);

COMMIT;
