-- CreateTable
CREATE TABLE "solicitud_idempotente" (
    "clave" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "operacion" VARCHAR(40) NOT NULL,
    "huella" CHAR(64) NOT NULL,
    "respuesta" JSONB NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_idempotente_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "solicitud_idempotente_usuario_id_creado_en_idx" ON "solicitud_idempotente"("usuario_id", "creado_en");

-- AddForeignKey
ALTER TABLE "solicitud_idempotente" ADD CONSTRAINT "solicitud_idempotente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Solo insercion, igual que la bitacora y el libro de inventario.
DROP TRIGGER IF EXISTS trg_solicitud_solo_insercion ON solicitud_idempotente;
CREATE TRIGGER trg_solicitud_solo_insercion
  BEFORE UPDATE OR DELETE ON solicitud_idempotente
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

DROP TRIGGER IF EXISTS trg_solicitud_sin_truncate ON solicitud_idempotente;
CREATE TRIGGER trg_solicitud_sin_truncate
  BEFORE TRUNCATE ON solicitud_idempotente
  FOR EACH STATEMENT EXECUTE FUNCTION fn_solo_insercion();
