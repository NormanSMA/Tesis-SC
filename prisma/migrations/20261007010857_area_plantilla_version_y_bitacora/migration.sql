-- AlterEnum
ALTER TYPE "entidad_bitacora" ADD VALUE 'AREA';

-- AlterTable
ALTER TABLE "area" ADD COLUMN     "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "etapa_plantilla" ADD COLUMN     "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
