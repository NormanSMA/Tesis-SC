#!/bin/sh
# Crea o actualiza el rol de la aplicacion. Ejecutar despues de migrar. Idempotente.
# Entorno: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, APP_DB_PASSWORD.
# Opcional: APP_DB_USER (sc_app), DB_HOST (127.0.0.1), DB_PORT_INTERNO (5432).
set -eu

directorio=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

PGHOST="${DB_HOST:-127.0.0.1}"
PGPORT="${DB_PORT_INTERNO:-5432}"
PGUSER="${POSTGRES_USER:?Falta POSTGRES_USER}"
PGPASSWORD="${POSTGRES_PASSWORD:?Falta POSTGRES_PASSWORD}"
PGDATABASE="${POSTGRES_DB:?Falta POSTGRES_DB}"
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

rol="${APP_DB_USER:-sc_app}"
clave="${APP_DB_PASSWORD:?Falta APP_DB_PASSWORD}"

# La clave entra por la variable de psql y set_config. No se interpola en texto SQL.
psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 -v rol="$rol" -v clave="$clave" <<SQL
SELECT set_config('sc.rol', :'rol', false), set_config('sc.clave', :'clave', false) \gset
\i $directorio/roles.sql
SQL

echo "Rol ${rol} listo en ${PGDATABASE}."
