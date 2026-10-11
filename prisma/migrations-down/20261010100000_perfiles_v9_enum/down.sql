-- PostgreSQL no permite eliminar valores de enum mediante ALTER TYPE.
-- ADMINISTRACION y OPERACIONES permanecen; restaurar el respaldo anterior permite eliminarlos.
-- Reasignar sus perfiles requiere una decisión de negocio antes de usar código anterior.
ALTER TYPE "codigo_perfil" RENAME VALUE 'ATENCION_CLIENTE' TO 'VENTAS';
