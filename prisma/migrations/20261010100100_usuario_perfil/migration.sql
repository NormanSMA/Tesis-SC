-- ADR-014 M2: varios perfiles por usuario (usuario_roles del ERD v9).
-- usuario.perfil_id se conserva hasta M8 (expandir y contraer).
CREATE TABLE "usuario_perfil" (
    "usuario_id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "asignado_por_id" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_perfil_pkey" PRIMARY KEY ("usuario_id","perfil_id")
);

-- CreateIndex
CREATE INDEX "usuario_perfil_perfil_id_idx" ON "usuario_perfil"("perfil_id");

-- AddForeignKey
ALTER TABLE "usuario_perfil" ADD CONSTRAINT "usuario_perfil_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_perfil" ADD CONSTRAINT "usuario_perfil_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_perfil" ADD CONSTRAINT "usuario_perfil_asignado_por_id_fkey" FOREIGN KEY ("asignado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada usuario conserva su perfil actual.
INSERT INTO "usuario_perfil" ("usuario_id", "perfil_id")
SELECT "id", "perfil_id" FROM "usuario";

-- La matriz cambia con la Tabla 14: se retiran los permisos de los perfiles de negocio existentes.
-- La siembra de referencia vuelve a conceder la matriz por defecto. ADMIN no cambia.
DELETE FROM "perfil_permiso"
WHERE "perfil_id" IN (SELECT "id" FROM "perfil" WHERE "codigo" IN ('GERENCIA', 'ATENCION_CLIENTE', 'PRODUCCION'));
