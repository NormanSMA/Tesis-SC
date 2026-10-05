#!/bin/sh
# Restaura un respaldo hecho con respaldo.sh. Reemplaza los datos actuales.
# Uso: sh scripts/restaurar.sh <archivo.dump> --confirmar
set -eu

raiz=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$raiz"

archivo="${1:-}"
if [ -z "$archivo" ] || [ ! -f "$archivo" ]; then
  echo "Uso: sh scripts/restaurar.sh <archivo.dump> --confirmar" >&2
  exit 1
fi
if [ "${2:-}" != "--confirmar" ]; then
  echo "Esto reemplaza todos los datos actuales. Repite el comando con --confirmar." >&2
  exit 1
fi

# Sin la aplicacion conectada, pg_restore puede borrar y recrear las tablas.
docker compose stop app
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --exit-on-error' < "$archivo"
# --clean recrea las tablas: se vuelven a aplicar los permisos de sc_app.
docker compose run --rm --no-deps migrate sh scripts/db/roles.sh
# --no-deps evita volver a ejecutar migrate (y la siembra) tras restaurar.
docker compose up -d --no-deps app

echo "Restauracion completa desde: $archivo"
