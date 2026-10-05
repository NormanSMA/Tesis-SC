#!/bin/sh
# Prepara la base: migra, crea el rol de la aplicacion y siembra. Lo usa el servicio migrate.
set -eu

directorio=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

pnpm exec prisma migrate deploy
sh "$directorio/roles.sh"
pnpm db:seed
