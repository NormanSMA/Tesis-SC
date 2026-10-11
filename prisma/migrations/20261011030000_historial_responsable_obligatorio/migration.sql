-- RB-08 (tesis v9): todo cambio de etapa en curso o completada conserva etapa, responsable y fecha-hora.
-- Las filas rellenadas desde la bitacora no traian responsable: se completan con el responsable vigente de
-- la etapa o, si no lo hay, con quien hizo el cambio. La tabla es de solo insercion: el relleno desactiva el trigger.
ALTER TABLE "historial_etapa" DISABLE TRIGGER "trg_historial_etapa_solo_insercion";
UPDATE "historial_etapa" h SET "responsable_id" = coalesce(e."responsable_id", h."usuario_id")
FROM "etapa_orden" e
WHERE e."id" = h."etapa_id" AND h."responsable_id" IS NULL AND h."estado_nuevo" IN ('EN_CURSO', 'COMPLETADA');
ALTER TABLE "historial_etapa" ENABLE TRIGGER "trg_historial_etapa_solo_insercion";

ALTER TABLE "historial_etapa" DROP CONSTRAINT IF EXISTS "historial_etapa_responsable_obligatorio";
ALTER TABLE "historial_etapa" ADD CONSTRAINT "historial_etapa_responsable_obligatorio"
  CHECK ("estado_nuevo" NOT IN ('EN_CURSO', 'COMPLETADA') OR "responsable_id" IS NOT NULL);
