-- Auditoria de seguridad (2026-10-11): la clave temporal debe caducar y obligar a cambiarla.
ALTER TABLE "usuario"
  ADD COLUMN "contrasena_temporal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contrasena_temporal_expira_en" TIMESTAMPTZ(6);

ALTER TABLE "usuario" ADD CONSTRAINT "usuario_clave_temporal_con_vencimiento"
  CHECK ("contrasena_temporal" = false OR "contrasena_temporal_expira_en" IS NOT NULL);
