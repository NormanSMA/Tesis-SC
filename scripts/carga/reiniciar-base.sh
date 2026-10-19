#!/bin/sh
# Borra y vuelve a crear la base sc_carga (nunca sc_plataforma) y la deja migrada. Uso: sh scripts/carga/reiniciar-base.sh
set -eu
cd "$(dirname "$0")/../.."
compose="docker compose -f compose.yaml -f docker-compose.carga.yml"
$compose rm -sf app_carga carga_migrate carga_db >/dev/null 2>&1 || true
$compose up -d --wait db
$compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS sc_carga WITH (FORCE)"'
rm -f scripts/carga/sesiones.json scripts/carga/concurrencia.json scripts/carga/estado.json
$compose up -d --wait app_carga
