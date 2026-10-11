#!/bin/sh
# Prueba de respaldo y recuperacion (RNF-06 y RNF-07). No toca la base en uso:
# respalda, restaura en una base temporal "sc_recuperacion" y compara.
# Uso: sh scripts/prueba-recuperacion.sh
# Requiere el servicio db en marcha: docker compose up -d db
set -eu

raiz=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$raiz"

limite_s=14400   # RNF-07: restauracion en 4 horas como maximo
temporal=sc_recuperacion

psql_db() { docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d $1 -v ON_ERROR_STOP=1 -At -c \"$2\""; }
psql_postgres() { psql_db postgres "$1"; }

echo "1. Respaldo"
inicio=$(date +%s)
archivo_local=$(sh scripts/respaldo.sh respaldos/prueba | sed 's/^Respaldo creado: //')
t_respaldo=$(( $(date +%s) - inicio ))
bytes=$(wc -c < "$archivo_local")
echo "   archivo: $archivo_local ($bytes bytes), $t_respaldo s"

echo "2. Restauracion en la base temporal $temporal"
psql_postgres "DROP DATABASE IF EXISTS $temporal WITH (FORCE)" > /dev/null
psql_postgres "CREATE DATABASE $temporal" > /dev/null
inicio=$(date +%s)
docker compose exec -T db sh -c "pg_restore -U \"\$POSTGRES_USER\" -d $temporal --no-owner --exit-on-error" < "$archivo_local"
t_restauracion=$(( $(date +%s) - inicio ))
echo "   restauracion completa en $t_restauracion s"

echo "3. Integridad"
falla=0
principal=$(docker compose exec -T db sh -c 'echo "$POSTGRES_DB"' | tr -d '\r')
tablas=$(psql_db "$principal" "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY 1" | tr -d '\r')
for tabla in $tablas; do
  a=$(psql_db "$principal" "SELECT count(*) FROM $tabla" | tr -d '\r')
  b=$(psql_db "$temporal" "SELECT count(*) FROM $tabla" | tr -d '\r')
  if [ "$a" != "$b" ]; then echo "   DIFERENCIA en $tabla: origen $a, restaurada $b"; falla=1; fi
done
echo "   tablas comparadas: $(echo "$tablas" | wc -l | tr -d ' ')"
sin_validar=$(psql_db "$temporal" "SELECT count(*) FROM pg_constraint WHERE NOT convalidated" | tr -d '\r')
negativas=$(psql_db "$temporal" "SELECT count(*) FROM material WHERE existencia < 0" | tr -d '\r')
descuadre=$(psql_db "$temporal" "SELECT count(*) FROM material m WHERE m.existencia <> coalesce((SELECT sum(cantidad) FROM movimiento_inventario WHERE material_id = m.id), 0)" | tr -d '\r')
huerfanos=$(psql_db "$temporal" "SELECT (SELECT count(*) FROM orden_trabajo o WHERE NOT EXISTS (SELECT 1 FROM cotizacion c WHERE c.id = o.cotizacion_id)) + (SELECT count(*) FROM consumo_orden c WHERE NOT EXISTS (SELECT 1 FROM orden_trabajo o WHERE o.id = c.orden_id))" | tr -d '\r')
duplicadas=$(psql_db "$temporal" "SELECT count(*) FROM (SELECT cotizacion_id FROM orden_trabajo GROUP BY 1 HAVING count(*) > 1) d" | tr -d '\r')
echo "   restricciones sin validar: $sin_validar; existencias negativas: $negativas; descuadre libro: $descuadre; huerfanos: $huerfanos; ordenes duplicadas: $duplicadas"
[ "$sin_validar" = 0 ] && [ "$negativas" = 0 ] && [ "$descuadre" = 0 ] && [ "$huerfanos" = 0 ] && [ "$duplicadas" = 0 ] || falla=1

psql_postgres "DROP DATABASE $temporal WITH (FORCE)" > /dev/null

total=$(( t_respaldo + t_restauracion ))
echo "4. Resultado"
echo "   tiempo de respaldo: $t_respaldo s; restauracion: $t_restauracion s; limite RNF-07: $limite_s s"
if [ "$falla" = 0 ] && [ "$t_restauracion" -le "$limite_s" ]; then
  echo "   CUMPLE RNF-06 (respaldo verificable) y RNF-07 (restauracion sin errores de integridad en el limite)"
else
  echo "   NO CUMPLE: revisa las diferencias de arriba" >&2
  exit 1
fi
