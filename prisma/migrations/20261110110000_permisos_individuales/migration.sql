BEGIN;
CREATE TABLE usuario_permiso (
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  permiso_id uuid NOT NULL REFERENCES permiso(id) ON DELETE RESTRICT,
  otorgado_por_id uuid REFERENCES usuario(id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, permiso_id)
);
CREATE INDEX usuario_permiso_permiso_id_idx ON usuario_permiso(permiso_id);
CREATE INDEX usuario_permiso_otorgado_por_id_idx ON usuario_permiso(otorgado_por_id);
INSERT INTO permiso (recurso, accion, descripcion) VALUES
  ('cotizacion','ver_todas','Ver cotizaciones de otros usuarios') ON CONFLICT (recurso, accion) DO NOTHING;
INSERT INTO perfil_permiso (perfil_id, permiso_id)
SELECT p.id,x.id FROM perfil p CROSS JOIN permiso x
WHERE p.codigo='GERENCIA' AND x.recurso='cotizacion' AND x.accion='ver_todas'
ON CONFLICT DO NOTHING;
INSERT INTO usuario_permiso (usuario_id, permiso_id, otorgado_por_id)
SELECT u.id,p.id,(SELECT id FROM usuario WHERE correo='pruebas.admin@solucionescreativas.test')
FROM usuario u CROSS JOIN permiso p
WHERE u.correo='arely.rodriguez@solucionescreativas.test' AND p.recurso='cotizacion' AND p.accion='ver_todas'
ON CONFLICT DO NOTHING;
INSERT INTO bitacora(entidad,entidad_id,accion,usuario_id,detalle)
SELECT 'USUARIO',up.usuario_id,'OTORGAR_PERMISO',up.otorgado_por_id,
  '{"recurso":"cotizacion","accion":"ver_todas","alcance":"individual"}'::jsonb
FROM usuario_permiso up WHERE up.otorgado_por_id IS NOT NULL;
COMMIT;
