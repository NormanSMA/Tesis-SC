# Fase 2.8: dependencias y secretos (2026-10-11)

Herramientas: `pnpm audit --prod`, osv-scanner, Trivy `fs` y gitleaks (historial de 56 commits). Imágenes autorizadas por Norman. Valores de secretos no copiados.

## Dependencias (4 paquetes; 0 CRITICAL)
Las cuatro rutas son transitivas. Ninguna se alcanza en ejecución:
- P3 `mysql2` 3.15.3 (GHSA-3f6p-5ww8-9rcr HIGH, GHSA-rgwj-5xj2-c3m3 MEDIUM). Ruta: `prisma` > `mysql2`. El proyecto usa solo PostgreSQL; no hay código MySQL. No alcanzable.
- P3 `deepmerge-ts` 7.1.5 (CVE-2026-40345 HIGH). Ruta: `prisma` > `@prisma/config`. Fusiona `prisma.config.ts`, archivo propio sin entrada de usuario. No alcanzable.
- P3 `uuid` 8.3.2 (CVE-2026-41907). Ruta: `exceljs` > `uuid`. Verificado: `exceljs` solo llama `uuidv4()` sin búfer (`cf-rule-ext-xform.js:43,77`). El defecto exige `buf` en v3/v5/v6. No alcanzable.
- P3 `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm, solo osv-scanner, sin versión corregida). Ruta: `eslint-config-next` > ... > `micromatch`. Solo desarrollo.
- Arreglo propuesto: no subir Prisma (congelado hasta la defensa). Registrar los cuatro en el ADR de riesgos aceptados con la razón de no alcance y revisar al terminar la tesis. Quitar el ruido de `audit:code` con `pnpm audit --prod --audit-level=critical` y `ignoreGhsas` documentados en `pnpm-workspace.yaml`.
- Prueba de regresión: `pnpm audit --prod --audit-level=critical` sale 0 hoy; falla si aparece un CRITICAL nuevo.

## Secretos
- Trivy (vuln, secret, misconfig; sin `node_modules`, `.next`, `.git`, capturas, `output`, `respaldos`, `audit`, `public`, `src/generated`): 0 secretos, 0 errores de configuración. `Dockerfile` limpio.
- gitleaks (historial completo): 9 coincidencias `generic-api-key` en `.env.example` (4) y `tests/integration/seed.test.ts` (5), en commits `b1cd23c9` y `a758f7cf`.
- Verificado: son las variables `SEED_PASSWORD_*`. El archivo declara "valores ficticios solo para desarrollo local" y la prueba "claves ficticias solo para esta prueba". Falsos positivos de diseño. `.env` real está en `.gitignore` y no tiene versión en git.
- P3: sin `.gitleaks.toml`, cada ejecución repetirá las 9. Arreglo: agregar `.gitleaks.toml` con allowlist para esas dos rutas y regla `SEED_PASSWORD_`. Prueba: `gitleaks detect` sale 0.
- P3: confirmar que la clave de la base de demostración (`cambiar-en-produccion`) y las `SEED_PASSWORD_*` no se usan en producción. Ya cubierto en la fase 3.2 (secretos fuera de la imagen).

## Cierre
- Sin P0, P1 ni P2.
- Trivy tardó 12,5 min en Windows con montaje; en CI (Linux) será mucho menor.
