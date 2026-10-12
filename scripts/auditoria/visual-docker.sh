#!/usr/bin/env bash
# Regresión visual con render estable: corre Playwright dentro de la imagen oficial contra la app local.
# Uso: bash scripts/auditoria/visual-docker.sh [--update-snapshots]
# Requiere la app en http://127.0.0.1:3000 (docker compose up -d app). No usa node_modules del equipo.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p e2e/instantaneas
MSYS_NO_PATHCONV=1 docker run --rm --ipc=host \
  -e E2E_BASE_URL=http://host.docker.internal:3000 \
  -v "$PWD:/src:ro" \
  -v "$PWD/e2e/instantaneas:/out" \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -c '
    set -e
    mkdir /work && cd /work
    cp -r /src/e2e /src/playwright.config.ts . && cp /src/.env.example ./.env
    rm -rf e2e/instantaneas && mkdir -p e2e/instantaneas && cp -r /out/. e2e/instantaneas/ 2>/dev/null || true
    npm init -y >/dev/null
    npm i --silent @playwright/test@1.63.0 @axe-core/playwright@4.13.0 dotenv@18.0.5 >/dev/null 2>&1
    set +e
    npx playwright test e2e/regresion-visual.spec.ts --project=portatil --reporter=list '"$*"'
    estado=$?
    cp -r e2e/instantaneas/. /out/
    [ -d test-results ] && cp -r test-results /out/_resultados 2>/dev/null
    exit $estado
  '
