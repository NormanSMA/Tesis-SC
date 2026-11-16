BEGIN;

CREATE TABLE usuario_area (
  usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
  area_id UUID NOT NULL REFERENCES area(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (usuario_id, area_id)
);
CREATE INDEX usuario_area_area_id_idx ON usuario_area(area_id);

INSERT INTO usuario_area (usuario_id, area_id)
SELECT u.id, a.id
FROM (VALUES
  ('danny.gahona', ARRAY['Grabado y Corte Láser', 'Corte y láser']),
  ('gabriel.morales', ARRAY['Impresión Digital', 'Impresión']),
  ('nathaly.chavarria', ARRAY['Diseño Gráfico', 'Diseño y artes gráficas']),
  ('mariam.garcia', ARRAY['Diseño Gráfico', 'Diseño y artes gráficas']),
  ('eykelt.torrez', ARRAY['Diseño Gráfico', 'Diseño y artes gráficas']),
  ('norman.solis', ARRAY['Acabado', 'Acabados']),
  ('jose.osegueda', ARRAY['Acabado', 'Acabados']),
  ('felix.osegueda', ARRAY['Acabado', 'Acabados']),
  ('mario.pineda', ARRAY['Taller', 'Carpintería y metalmecánica']),
  ('luis.zeledon', ARRAY['Taller', 'Carpintería y metalmecánica'])
) AS asignacion(alias, nombres)
JOIN usuario u ON u.correo = asignacion.alias || '@solucionescreativas.test'
JOIN area a ON a.nombre = ANY (asignacion.nombres);

COMMIT;
