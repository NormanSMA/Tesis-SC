-- ADR-014 M4b: registro de la aprobacion comercial (RB-10) y version corregida de la cotizacion.
ALTER TABLE "cotizacion"
  ADD COLUMN "usuario_aprobacion_id" UUID,
  ADD COLUMN "referencia_aprobacion" VARCHAR(200),
  ADD COLUMN "version" SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN "motivo_ajuste" TEXT;

ALTER TABLE "cotizacion" ADD CONSTRAINT "cotizacion_usuario_aprobacion_id_fkey"
  FOREIGN KEY ("usuario_aprobacion_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "cotizacion_usuario_aprobacion_id_idx" ON "cotizacion"("usuario_aprobacion_id");

-- Relleno de las cotizaciones aprobadas antes de v9. El trigger de congelado impide este UPDATE.
ALTER TABLE "cotizacion" DISABLE TRIGGER "trg_cotizacion_congelar";
UPDATE "cotizacion" c SET
  "usuario_aprobacion_id" = coalesce((
    SELECT b."usuario_id" FROM "bitacora" b
    WHERE b."cotizacion_id" = c."id" AND b."accion" = 'CAMBIAR_ESTADO' AND b."estado_nuevo" = 'APROBADA'
    ORDER BY b."creado_en" DESC LIMIT 1
  ), c."creado_por_id"),
  "referencia_aprobacion" = 'Aprobación registrada antes de la versión 9 del sistema'
WHERE c."estado" = 'APROBADA';
ALTER TABLE "cotizacion" ENABLE TRIGGER "trg_cotizacion_congelar";
