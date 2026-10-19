#!/bin/sh
# Corre las pruebas de carga contra el entorno aparte (base sc_carga, app en 127.0.0.1:3100).
# Uso: sh scripts/carga/correr.sh [--reiniciar-base] [--sin-reinicio-app] [escenario ...]
#   Escenarios: lectura-mixta pico concurrencia resistencia. Sin escenarios corre los cuatro, en ese orden.
#   --reiniciar-base: borra y recrea sc_carga antes de sembrar. Sin la opcion se reutiliza el volumen sembrado.
#   --sin-reinicio-app: no reinicia app_carga entre escenarios (por defecto se reinicia para medir con metricas limpias).
# Resultados en output/carga/: <escenario>.json (resumen de k6), <escenario>.log, <escenario>-sistema.json, <escenario>-integridad.json.
set -u
cd "$(dirname "$0")/../.."

imagen_k6="grafana/k6:1.3.0"
compose="docker compose -f compose.yaml -f docker-compose.carga.yml"
salida="output/carga"
reiniciar_base=0
reiniciar_app=1
escenarios=""

for argumento in "$@"; do
  case "$argumento" in
    --reiniciar-base) reiniciar_base=1 ;;
    --sin-reinicio-app) reiniciar_app=0 ;;
    lectura-mixta|pico|concurrencia|resistencia) escenarios="$escenarios $argumento" ;;
    *) echo "Argumento no valido: $argumento" >&2; exit 2 ;;
  esac
done
[ -n "$escenarios" ] || escenarios="lectura-mixta pico concurrencia resistencia"

mkdir -p "$salida"
raiz_docker=$(pwd -W 2>/dev/null || pwd)

if [ "$reiniciar_base" = 1 ]; then
  sh scripts/carga/reiniciar-base.sh || exit 1
else
  $compose up -d --wait app_carga || exit 1
fi

node scripts/carga/sembrar-masivo.mjs || exit 1

fallos=0
for escenario in $escenarios; do
  echo "=== $escenario ==="
  if [ "$reiniciar_app" = 1 ]; then
    $compose restart app_carga >/dev/null && $compose up -d --wait app_carga >/dev/null || { fallos=$((fallos + 1)); continue; }
  fi
  # Cada escenario parte de un entorno y de fixtures sin consumir.
  node scripts/carga/sembrar-masivo.mjs --solo-fixtures >/dev/null || { fallos=$((fallos + 1)); continue; }
  # El estado de salida de k6 se guarda aparte: en sh, "| tee" devolveria el de tee.
  {
    MSYS_NO_PATHCONV=1 docker run --rm --add-host host.docker.internal:host-gateway       -v "$raiz_docker/scripts/carga:/carga:ro" -v "$raiz_docker/$salida:/out"       "$imagen_k6" run --summary-export="/out/$escenario.json" "/carga/k6/$escenario.js" 2>&1
    echo $? > "$salida/.k6_rc"
  } | tee "$salida/$escenario.log"
  k6_rc=$(cat "$salida/.k6_rc")
  [ "$k6_rc" -eq 0 ] || { echo "k6 termino con umbrales no cumplidos o error ($escenario)."; fallos=$((fallos + 1)); }
  node scripts/carga/comparar-sistema.mjs --k6 "$salida/$escenario.json" --salida "$salida/$escenario-sistema.json" || fallos=$((fallos + 1))
  opcion_k6=""
  [ "$escenario" = "concurrencia" ] && opcion_k6="--k6 $salida/$escenario.json"
  node scripts/carga/verificar-integridad.mjs $opcion_k6 --salida "$salida/$escenario-integridad.json" || fallos=$((fallos + 1))
done

echo "Resultados en $salida/. Pasos con fallo: $fallos"
[ "$fallos" -eq 0 ]
