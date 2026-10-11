-- Las claves temporales vigentes dejan de exigir cambio al revertir; reinicie las claves de esos usuarios.
ALTER TABLE "usuario" DROP CONSTRAINT IF EXISTS "usuario_clave_temporal_con_vencimiento";
ALTER TABLE "usuario" DROP COLUMN IF EXISTS "contrasena_temporal_expira_en", DROP COLUMN IF EXISTS "contrasena_temporal";
