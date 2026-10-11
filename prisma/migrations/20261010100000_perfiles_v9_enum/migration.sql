-- ADR-014 M1: perfiles de la tesis v9 (Tabla 14).
-- VENTAS pasa a ATENCION_CLIENTE y conserva su UUID. ADMINISTRACION y OPERACIONES son nuevos.
-- Va sola: un valor de enum agregado no se puede usar en la misma transaccion.
ALTER TYPE "codigo_perfil" RENAME VALUE 'VENTAS' TO 'ATENCION_CLIENTE';
ALTER TYPE "codigo_perfil" ADD VALUE IF NOT EXISTS 'ADMINISTRACION';
ALTER TYPE "codigo_perfil" ADD VALUE IF NOT EXISTS 'OPERACIONES';
