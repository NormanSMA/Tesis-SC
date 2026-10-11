-- ADR-014 M8 (contraer): los perfiles de un usuario viven solo en usuario_perfil.
-- Aborta si algun usuario quedaria sin perfil.
DO $comprobar$
BEGIN
  IF EXISTS (SELECT 1 FROM "usuario" u WHERE NOT EXISTS (SELECT 1 FROM "usuario_perfil" up WHERE up."usuario_id" = u."id")) THEN
    RAISE EXCEPTION 'Hay usuarios sin filas en usuario_perfil: no se puede eliminar usuario.perfil_id';
  END IF;
END
$comprobar$;

-- DropForeignKey
ALTER TABLE "usuario" DROP CONSTRAINT "usuario_perfil_id_fkey";

-- DropIndex
DROP INDEX "usuario_perfil_id_activo_idx";

-- AlterTable
ALTER TABLE "usuario" DROP COLUMN "perfil_id";

-- CreateIndex
CREATE INDEX "usuario_activo_idx" ON "usuario"("activo");
