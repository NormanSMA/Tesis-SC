-- PostgreSQL no permite quitar valores de un enum. Los valores nuevos quedan sin uso tras revertir el código.
-- Si hace falta limpiarlos, recree el tipo accion_bitacora sin ellos y migre la columna bitacora.accion.
SELECT 1;
