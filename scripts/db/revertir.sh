#!/bin/sh
set -eu

if [ "$#" -ne 2 ] || [ "${2:-}" != "--confirmar" ]; then
  echo "Uso: sh scripts/db/revertir.sh <nombre_migracion> --confirmar" >&2
  exit 1
fi

migracion="$1"
case "$migracion" in
  ''|*[!a-z0-9_]*) echo "Nombre de migración inválido." >&2; exit 1 ;;
esac

raiz=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$raiz"
archivo="$raiz/prisma/migrations-down/$migracion/down.sql"
if [ ! -f "$archivo" ] || [ ! -f "prisma/migrations/$migracion/migration.sql" ]; then
  echo "No existe una reversión versionada para $migracion." >&2
  exit 1
fi

sql_reversion=$(cat "$archivo")
echo "Detenga la aplicación durante toda la reversión."
mkdir -p "$raiz/respaldos"
carpeta=$(mktemp -d "$raiz/respaldos/reversion-$migracion-XXXXXX")
sh "$raiz/scripts/respaldo.sh" "$carpeta"

{
  cat <<'SQL'
LOCK TABLE "_prisma_migrations" IN EXCLUSIVE MODE;
SELECT set_config('sc.migracion_revertir', :'migracion', true);
DO $comprobar$
DECLARE
  v_migracion text := current_setting('sc.migracion_revertir');
  v_ultima text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Resuelva las migraciones incompletas antes de revertir';
  END IF;
  SELECT migration_name INTO v_ultima FROM "_prisma_migrations"
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  ORDER BY migration_name DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM v_migracion THEN
    RAISE EXCEPTION 'Solo se puede revertir la última migración aplicada: %', v_ultima;
  END IF;
END;
$comprobar$;
SQL
  printf '%s\n' "$sql_reversion"
  cat <<'SQL'
DELETE FROM "_prisma_migrations"
WHERE migration_name = :'migracion' AND rolled_back_at IS NULL;
SQL
} | docker compose exec -T db sh -c '
  exec psql --no-psqlrc -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 --set=migracion="$1" --single-transaction --file=-
' sh "$migracion"

echo "Reversión terminada: $migracion. Respaldo: $carpeta"
