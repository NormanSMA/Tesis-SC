-- Los permisos eliminados por esta migración requieren un respaldo anterior a v9.
-- El respaldo previo al down no contiene los permisos originales eliminados.
-- Eliminar usuario_perfil pierde asignaciones adicionales y sus datos de auditoría.
-- Conservar usuario.perfil_id; revertir primero usuario_sin_perfil_id si ya fue aplicada.
ALTER TABLE "usuario_perfil" DROP CONSTRAINT "usuario_perfil_asignado_por_id_fkey";
ALTER TABLE "usuario_perfil" DROP CONSTRAINT "usuario_perfil_perfil_id_fkey";
ALTER TABLE "usuario_perfil" DROP CONSTRAINT "usuario_perfil_usuario_id_fkey";
DROP INDEX "usuario_perfil_perfil_id_idx";
DROP TABLE "usuario_perfil";
