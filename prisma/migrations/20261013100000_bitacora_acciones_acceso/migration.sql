-- Acciones de la bitácora de seguridad de accesos (ADR-017). Solo agrega valores; ninguna sentencia los usa.
SET lock_timeout = '1s';
SET statement_timeout = '5s';
ALTER TYPE "accion_bitacora" ADD VALUE IF NOT EXISTS 'INICIAR_SESION';
ALTER TYPE "accion_bitacora" ADD VALUE IF NOT EXISTS 'INICIO_SESION_FALLIDO';
ALTER TYPE "accion_bitacora" ADD VALUE IF NOT EXISTS 'BLOQUEAR_CUENTA';
ALTER TYPE "accion_bitacora" ADD VALUE IF NOT EXISTS 'CERRAR_SESION';
ALTER TYPE "accion_bitacora" ADD VALUE IF NOT EXISTS 'CAMBIAR_CLAVE';
