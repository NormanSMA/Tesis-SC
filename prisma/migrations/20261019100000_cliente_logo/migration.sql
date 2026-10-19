SET lock_timeout = '1s';
SET statement_timeout = '5s';

CREATE TABLE cliente_logo (
  cliente_id uuid PRIMARY KEY REFERENCES cliente(id) ON DELETE CASCADE ON UPDATE CASCADE,
  contenido bytea NOT NULL,
  tipo text NOT NULL,
  tamano integer NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_logo_tipo_valido CHECK (tipo IN ('image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT cliente_logo_tamano_valido CHECK (tamano >= 0 AND tamano <= 524288),
  CONSTRAINT cliente_logo_tamano_coincide CHECK (octet_length(contenido) = tamano)
);
