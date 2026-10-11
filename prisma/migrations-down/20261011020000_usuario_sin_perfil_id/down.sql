-- El perfil original eliminado no puede identificarse entre múltiples asignaciones.
-- Restaurar perfil_id desde usuario_perfil con el perfil principal vigente.
-- Usar el orden de src/core/permisos.ts; recuperar el original requiere un respaldo anterior.
ALTER TABLE "usuario" ADD COLUMN "perfil_id" UUID;

UPDATE "usuario" u SET "perfil_id" = principal."perfil_id"
FROM (
  SELECT DISTINCT ON (up."usuario_id") up."usuario_id", up."perfil_id"
  FROM "usuario_perfil" up
  JOIN "perfil" p ON p."id" = up."perfil_id"
  ORDER BY up."usuario_id", CASE p."codigo"::text
    WHEN 'GERENCIA' THEN 1
    WHEN 'ADMINISTRACION' THEN 2
    WHEN 'OPERACIONES' THEN 3
    WHEN 'ATENCION_CLIENTE' THEN 4
    WHEN 'PRODUCCION' THEN 5
    WHEN 'ADMIN' THEN 6
    ELSE 7
  END, up."perfil_id"
) principal
WHERE principal."usuario_id" = u."id";

DO $comprobar$
BEGIN
  IF EXISTS (SELECT 1 FROM "usuario" WHERE "perfil_id" IS NULL) THEN
    RAISE EXCEPTION 'Hay usuarios sin perfil: asigne usuario_perfil antes de revertir';
  END IF;
END;
$comprobar$;

ALTER TABLE "usuario" ALTER COLUMN "perfil_id" SET NOT NULL;
DROP INDEX "usuario_activo_idx";
CREATE INDEX "usuario_perfil_id_activo_idx" ON "usuario"("perfil_id", "activo");
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_perfil_id_fkey"
  FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
