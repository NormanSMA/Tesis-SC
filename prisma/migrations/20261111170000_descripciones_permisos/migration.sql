-- Textos visibles de permisos: la siembra no corre sobre bases con datos, por eso se actualizan aquí.
UPDATE permiso SET descripcion = 'Gestionar productos, materiales del producto, categorías, áreas y plantillas'
  WHERE recurso = 'catalogo' AND accion = 'gestionar';
UPDATE permiso SET descripcion = 'Marcar como hechas las etapas de producción'
  WHERE recurso = 'produccion' AND accion = 'ejecutar';
