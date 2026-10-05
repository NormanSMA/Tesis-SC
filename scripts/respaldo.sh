#!/bin/sh
# Respalda la base en formato custom de pg_dump, con fecha en el nombre (S-20).
# Uso: sh scripts/respaldo.sh [carpeta]   (por defecto ./respaldos)
# Requiere el servicio db en marcha: docker compose up -d db
set -eu

raiz=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$raiz"

carpeta="${1:-respaldos}"
mkdir -p "$carpeta"
archivo="$carpeta/sc-plataforma-$(date +%Y%m%d-%H%M%S).dump"

# El socket local del contenedor confia en el usuario del sistema postgres: no pide clave.
if ! docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$archivo"; then
  rm -f "$archivo"
  echo "El respaldo fallo. No se dejo ningun archivo." >&2
  exit 1
fi

if [ ! -s "$archivo" ]; then
  rm -f "$archivo"
  echo "El respaldo salio vacio. No se dejo ningun archivo." >&2
  exit 1
fi

echo "Respaldo creado: $archivo"
