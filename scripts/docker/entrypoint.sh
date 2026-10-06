#!/bin/sh
# Arma las URL de conexion dentro del contenedor desde las variables sueltas.
# DATABASE_URL de .env.example apunta al host de la maquina (127.0.0.1) y no sirve aqui.
# Uso: entrypoint.sh <app|propietario> <comando...>
set -eu

rol="$1"
shift

codificar() {
  node -p 'encodeURIComponent(process.argv[1])' "$1"
}

destino="@${DB_HOST:-db}:${DB_PORT_INTERNO:-5432}/${POSTGRES_DB}?schema=public"

DATABASE_URL="postgresql://$(codificar "${APP_DB_USER}"):$(codificar "${APP_DB_PASSWORD}")${destino}"
export DATABASE_URL

if [ "$rol" = "propietario" ]; then
  DATABASE_URL_MIGRACION="postgresql://$(codificar "${POSTGRES_USER}"):$(codificar "${POSTGRES_PASSWORD}")${destino}"
  export DATABASE_URL_MIGRACION
else
  # La aplicacion no necesita las credenciales del dueno de las tablas (ADR-009).
  unset POSTGRES_PASSWORD DATABASE_URL_MIGRACION TEST_DATABASE_URL
  # Las claves de la siembra solo las usa el servicio migrate.
  for nombre in $(env | sed -n "s/^(SEED_PASSWORD_[A-Z_]*)=.*//p"); do
    unset "$nombre"
  done
fi

exec "$@"
