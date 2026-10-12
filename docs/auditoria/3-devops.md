# Fase 3: DevOps (2026-10-12)

Auditor de lectura: Codex `revisar` (Dockerfile, compose, CI, respaldos). Mediciones: `tester`, ZAP y el orquestador. Verificado en disco por el orquestador.

## 3.1 y 3.2 Dockerfile y compose
- Sin hallazgos: multi-etapa, imagen final mínima, usuario `node`, `HEALTHCHECK`, healthchecks de `db` y `app`, puertos solo en 127.0.0.1, `restart`, volúmenes con nombre, `migrate` antes de `app`, separación de roles (ADR-009), Node 24 coherente con ADR-010 y `engines`.
- P2 `.dockerignore` solo excluía `.env`, `.env.local` y `.env.test`: un `.env.production` entraba al contexto de build. Corregido: `.env.*` salvo `.env.example`.
- P3 imágenes con tag móvil. Corregido: `postgres:17-alpine` fijada por digest `sha256:18cfe3ef…` (la que ya corre) y `node:24-bookworm-slim` por digest `sha256:d6aa754f…` en las dos etapas finales. Regresión: reconstrucción verificada (abajo).
- P3 sin límites de CPU y memoria en `compose.yaml:44`. Diferido: sin medición de carga real; la empresa es de una sede.
- P2 `docs/seed.md:34` indicaba `docker compose down -v`, que borra los volúmenes de datos y respaldos. Corregido: receta con `rm -sfv`, `volume rm sc-plataforma_sc_pgdata` y `up -d --build app`.
- P3 `jit=off` aplicado a `db` y `db_test` (hallazgo 2.3).

## 3.4 Arranque desde cero (medido)
- Reconstrucción de `app` y `migrate` con las bases fijadas por digest: correcta.
- `rm -sfv app migrate db`, borrado del volumen `sc_pgdata`, `up -d app`: app sana en 20 s. `/api/v1/salud` responde 200. `show jit` = off.
- Siembra tras el arranque: 28 clientes, 15 cotizaciones, 8 órdenes, 33 materiales, 10 usuarios. `db_test` sana y sin tocar (sus bases `_test` se conservan). Sin `down -v`.

## 3.6 CI
- Sin hallazgos: disparo en push y pull_request, `contents: read`, acciones `@v4`, límite de 30 minutos, tipos, ESLint, Vitest con PostgreSQL, build.
- P2 CI no ejecutaba E2E, auditoría de dependencias ni secretos. Corregido por Codex y revisado: `ci.yml` con caché de pnpm; nuevo `auditoria.yml` (pnpm audit crítico, ciclos y capas, gitleaks con `.gitleaks.toml`, Squawk solo sobre migraciones nuevas del PR); nuevo `e2e.yml` (PostgreSQL de servicio, build, proyecto portátil con 1 reintento, informe como artefacto, solo manual o push a main).
- Verificado: los tres archivos son YAML válido (js-yaml). `pnpm audit --prod --audit-level=critical` sale 0.
- NO verificado: ninguna ejecución real de los flujos. Requiere el primer `push` de Norman. Riesgos esperables: `pnpm start` con `output: standalone` y el tiempo del E2E.

## 3.5 Respaldo y recuperación
- P2 respaldos en el mismo equipo que la base (`compose.yaml:102`): un fallo del almacenamiento Docker pierde ambos. Recomendación para Norman: copiar el volumen de respaldos a otro disco o equipo. No es código.
- P3 respaldos sin cifrado (`scripts/respaldo-programado.sh:23`); P3 intervalo de 24 h más duración excede 24 h (`:41`); P3 la prueba de recuperación compara contra el origen vivo (`prueba-recuperacion.sh:37`).
- Evidencia histórica de RNF-06/07 en `docs/pruebas/respaldo-RNF-06-07.md` (2 s). Repetición v9: ver sección Mediciones.

## 3.7 Cabeceras y CSP (ZAP baseline pasivo, 0 FAIL, 6 avisos, 61 reglas sin alerta)
- P2 la CSP estaba en modo `Report-Only` (ZAP: "CSP Header Not Set"). Corregido: `Content-Security-Policy` obligatoria con `object-src 'none'` añadido; mismas fuentes `'self'`. Pendiente de comprobar en navegador (fase 4.1): 0 violaciones de CSP en consola.
- P2 ZAP envió el formulario de login por GET y la contraseña apareció en la URL (`/login?contrasena=…`). Sin JavaScript hidratado, el formulario sin `method` se envía por GET. Corregido: `method="post"` en el formulario de login y en el de cambio de clave. Con la hidratación normal `onSubmit` lo intercepta, sin cambio de comportamiento.
- P3 COEP ausente, "Big Redirect", "Non-Storable Content", "Modern Web Application": informativos; no se actúa.
- P3 `/_next/image` con la URL `/brand/isotipo.png&w=640&q=75` respondió 404 al rastreo de ZAP (ruta mal formada por el rastreador); no se reproduce en uso normal.

## Mediciones
- 3.5 Recuperación (`scripts/prueba-recuperacion.sh`, repetida con la base v9): salida 0. Respaldo 2 s, restauración 3 s, 61 s de ejecución total. 26 tablas comparadas; restricciones sin validar 0; existencias negativas 0; descuadre del libro 0; huérfanos 0; órdenes duplicadas 0. Veredicto del script: CUMPLE RNF-06 y RNF-07. El volcado queda en `respaldos/prueba/` (ignorado por git).
- 3.3 Trivy sobre la imagen de la app (base Debian 12.15; Node 24): 241 hallazgos del sistema operativo (CRITICAL 4, HIGH 54) y 21 de paquetes Node (HIGH 8, CRITICAL 0). Secretos: 0.
  - CRITICAL: `perl-base` (3, uno con corrección `5.36.0-7+deb12u4`) y `zlib1g` (CVE-2023-45853, `will_not_fix` de Debian, defecto de minizip). Ninguno lo ejecuta la aplicación; `perl-base` es paquete esencial de Debian.
  - HIGH del sistema: `util-linux`, `ncurses`, `systemd`, `gnutls`, `gzip`, `libacl`, `perl-base`; casi todos sin versión corregida publicada. Sin acceso desde la aplicación: el contenedor corre como `node`, sin shell expuesto.
  - HIGH Node: `brace-expansion`, `http-cache-semantics`, `ip-address`, `tar`, `undici`, todos transitivos de `exceljs` (archiver, unzipper) y de Next. La aplicación solo escribe archivos xlsx; no lee ZIP ni TAR de usuarios.
  - Arreglo aplicado (P2): `apt-get upgrade` en la etapa `runner` para tomar las correcciones ya publicadas de Debian (cierra la de `perl-base`). Se vuelve a escanear en la fase 5. El resto es riesgo aceptado, a revisar cuando se actualice Prisma o Next tras la defensa.
  - Comprobación de aceptación: `trivy image` en la fase 5; CRITICAL con corrección disponible = 0.
