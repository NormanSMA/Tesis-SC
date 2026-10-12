#!/bin/sh
# Respaldo programado (RNF-06: al menos un respaldo exitoso cada 24 horas).
# Corre dentro del servicio "respaldo" de compose.yaml (perfil respaldo):
#   docker compose --profile respaldo up -d respaldo
# Variables: INTERVALO_HORAS (23: deja margen para que RNF-06 se cumpla aunque el respaldo tarde), RETENCION_DIAS (7), REINTENTO_MINUTOS (60).
# Cada intento deja una linea en /respaldos/registro.log: fecha ISO, OK o FALLO, archivo y bytes.
set -u

intervalo_s=$(( ${INTERVALO_HORAS:-23} * 3600 ))
retencion=${RETENCION_DIAS:-7}
reintento_s=$(( ${REINTENTO_MINUTOS:-60} * 60 ))
destino=/respaldos
registro="$destino/registro.log"
mkdir -p "$destino"

anotar() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$registro"
}

respaldar() {
  archivo="$destino/sc-plataforma-$(date -u +%Y%m%d-%H%M%S).dump"
  export PGPASSWORD="$POSTGRES_PASSWORD"
  if ! pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom -f "$archivo"; then
    rm -f "$archivo"
    anotar "FALLO pg_dump"
    return 1
  fi
  # El respaldo solo cuenta si el archivo se puede leer.
  if ! pg_restore --list "$archivo" > /dev/null 2>&1 || [ ! -s "$archivo" ]; then
    rm -f "$archivo"
    anotar "FALLO verificacion"
    return 1
  fi
  anotar "OK $(basename "$archivo") $(wc -c < "$archivo")"
  find "$destino" -name 'sc-plataforma-*.dump' -mtime "+$retencion" -delete
  return 0
}

while true; do
  if respaldar; then
    sleep "$intervalo_s"
  else
    sleep "$reintento_s"
  fi
done
