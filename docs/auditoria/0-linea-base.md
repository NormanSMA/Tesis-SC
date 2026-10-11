# Fase 0: línea base (2026-10-11)

Fuente: `resumen.js` por el `tester`; verificado por el orquestador.

## Entorno
- Windows 11 Pro x64, 32 GB de memoria, 16 núcleos.
- node v26.4.0 (local), pnpm 11.1.1, npm 11.17.0. Docker usa Node 24 (AGENTS.md).
- next 16.3.8 (disponible 16.4.0: congelado hasta la defensa), react 19.3.0, typescript 5.9.3.
- prisma 7.10.0, vitest 4.1.11, eslint 9.39.5, @playwright/test 1.63.0, @axe-core/playwright 4.13.0.
- zod 4.6.5. Total: 34 paquetes directos. Next: `output: standalone`.
- Docker Compose v5.5.1.

## Contenedores activos
- sc-plataforma-app-1 (healthy) en 127.0.0.1:3000.
- sc-plataforma-db-1 (healthy) en 127.0.0.1:5442.
- sc-plataforma-db_test-1 (healthy) en 127.0.0.1:5443.
- omniroute (ajeno al proyecto) en 127.0.0.1:20128. No se toca.

## Git
- Rama main, HEAD `c72c1b3`.
- Sin commit: 23 capturas `docs/capturas/fase2/*.png` (regenerables), `package.json` (scripts `check:*` y `audit:*`) y `AGENTS.md` (definición de terminado).

## Observaciones
- P3: el desarrollo local usa Node 26.4 y la imagen usa Node 24. Verificar que las pruebas pasen en ambos (fase 3.1).
- P3: `next info` imprime un error de `yarn` ausente. No afecta; el proyecto usa pnpm.
