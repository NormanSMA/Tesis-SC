BEGIN;

INSERT INTO permiso (recurso, accion, descripcion)
VALUES ('cliente', 'crear', 'Dar de alta clientes')
ON CONFLICT (recurso, accion) DO UPDATE SET descripcion = EXCLUDED.descripcion;

UPDATE permiso SET descripcion = 'Crear, editar, archivar, reactivar e importar clientes'
WHERE recurso = 'cliente' AND accion = 'gestionar';

UPDATE perfil p SET descripcion = d.descripcion
FROM (VALUES
  ('GERENCIA', 'Acceso completo a la operación y la administración del sistema.'),
  ('ADMINISTRACION', 'Gestiona clientes, cotizaciones, órdenes, etapas, inventario y tarifas.'),
  ('OPERACIONES', 'Da de alta clientes, gestiona cotizaciones y órdenes, y consulta Inventario.'),
  ('ATENCION_CLIENTE', 'Gestiona clientes y cotizaciones. Convierte a orden y consulta el seguimiento.')
) AS d(codigo, descripcion)
WHERE p.codigo::text = d.codigo;

CREATE TEMP TABLE actor_migracion ON COMMIT DROP AS
SELECT u.id FROM usuario u
WHERE u.activo AND u.correo = 'pruebas.admin@solucionescreativas.test'
  AND EXISTS (SELECT 1 FROM usuario_perfil up JOIN perfil p ON p.id = up.perfil_id
    WHERE up.usuario_id = u.id AND p.codigo = 'ADMIN');

WITH altas AS (
  INSERT INTO perfil_permiso (perfil_id, permiso_id, otorgado_por_id)
  SELECT p.id, x.id, (SELECT id FROM actor_migracion)
  FROM perfil p CROSS JOIN permiso x
  WHERE p.codigo = 'GERENCIA'
    OR (p.codigo = 'ADMINISTRACION' AND x.recurso IN ('cliente', 'cotizacion', 'orden'))
    OR (p.codigo = 'OPERACIONES' AND (x.recurso IN ('cotizacion', 'orden')
      OR (x.recurso, x.accion) IN (('cliente', 'crear'), ('produccion', 'ejecutar'))))
    OR (p.codigo = 'ATENCION_CLIENTE' AND (x.recurso, x.accion) IN (('cliente', 'crear'), ('orden', 'crear')))
  ON CONFLICT (perfil_id, permiso_id) DO NOTHING
  RETURNING perfil_id, permiso_id
)
INSERT INTO bitacora (entidad, entidad_id, accion, usuario_id, detalle)
SELECT 'PERFIL_PERMISO', p.id, 'OTORGAR_PERMISO', a.id,
  jsonb_build_object('perfil', p.codigo, 'recurso', x.recurso, 'accion', x.accion, 'origen', 'Matriz de la versión definitiva')
FROM altas JOIN perfil p ON p.id = altas.perfil_id JOIN permiso x ON x.id = altas.permiso_id CROSS JOIN actor_migracion a;

WITH bajas AS (
  DELETE FROM perfil_permiso pp USING perfil p, permiso x
  WHERE pp.perfil_id = p.id AND pp.permiso_id = x.id
    AND (
      (p.codigo = 'ATENCION_CLIENTE' AND (
        (x.recurso = 'orden' AND x.accion NOT IN ('ver', 'crear'))
        OR (x.recurso = 'produccion' AND x.accion <> 'ver')
      ))
      OR (p.codigo = 'OPERACIONES' AND (
        (x.recurso = 'inventario' AND x.accion <> 'ver') OR x.recurso = 'material'
      ))
      OR (p.codigo = 'ADMINISTRACION' AND x.recurso IN ('usuario', 'permiso'))
    )
  RETURNING pp.perfil_id, pp.permiso_id
)
INSERT INTO bitacora (entidad, entidad_id, accion, usuario_id, detalle)
SELECT 'PERFIL_PERMISO', p.id, 'REVOCAR_PERMISO', a.id,
  jsonb_build_object('perfil', p.codigo, 'recurso', x.recurso, 'accion', x.accion, 'origen', 'Matriz de la versión definitiva')
FROM bajas JOIN perfil p ON p.id = bajas.perfil_id JOIN permiso x ON x.id = bajas.permiso_id CROSS JOIN actor_migracion a;

COMMIT;
