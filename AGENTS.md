# SC Plataforma: guía para agentes

Piloto de la tesis PCE de Norman Smith Martínez Acevedo y Jorge Alí Rodríguez (UAM).
Caso de estudio: Soluciones Creativas, Estelí.
Plataforma web que integra clientes, cotización, orden de trabajo, inventario, producción y trazabilidad.
Criterios de aceptación: CF-01 a CF-11 (docs/trazabilidad.md).

## Léelo antes de programar
- docs/analisis/05-modelo-datos.md: modelo, máquinas de estado, permisos por defecto, invariantes.
- docs/supuestos.md: supuestos aprobados. docs/decisiones.md: decisiones.
- C:\claude-mem\wiki\preferences\reglas-programacion.md: reglas de código.

## Stack
Next.js 16 (App Router), TypeScript 5 estricto, Prisma 7.10.0 con @prisma/adapter-pg, PostgreSQL 17, Tailwind 4, shadcn/ui, zod 4, Vitest, Playwright, axe.
Gestor: pnpm. Node 24 en Docker. Nunca uses npm ni yarn.

## Estructura
```
prisma/            schema.prisma, sql/restricciones.sql, migrations/, seed/
src/app/           rutas y páginas. api/v1/<recurso>/route.ts
src/core/          reglas puras, sin Next ni base de datos
src/modules/<m>/   service.ts, schema.ts (zod), repo.ts, tipos
src/components/    sistema de diseño (ui/) y piezas de layout
src/lib/           db, auth, errores, http, formato
tests/             unit, api, concurrencia
e2e/               Playwright por perfil
docs/              tesis, trazabilidad, decisiones, capturas
```

## Reglas de código
- Sin emojis. Sin comentarios que narren lo obvio. Comenta solo el porqué.
- Archivos menores a 500 líneas. Funciones menores a 50 líneas. Máximo 3 parámetros, o un objeto.
- Nombres de dominio en español sin tildes (Cliente, OrdenTrabajo, fechaEntrega). Texto visible en español con tildes.
- Sin abstracciones sin uso real. Sin utils genéricos.
- Imports al inicio. Alias `@/` para src.

## Convenciones de API
- Rutas bajo /api/v1/<recurso>. El handler es delgado: valida con zod, verifica permiso, llama al servicio, responde.
- Éxito: `{ "datos": ... }`. Listas: `{ "datos": [], "total": n, "pagina": n }`. Error: `{ "error": { "codigo", "mensaje", "campos"? } }`.
- Códigos HTTP: 400 entrada inválida, 401 sin sesión, 403 sin permiso, 404 no existe, 409 regla de negocio o conflicto, 422 validación de campos.
- Los errores SQLSTATE SC001 a SC007 del modelo se traducen a 409 con mensaje legible.
- Dinero y cantidades viajan como cadena decimal. Fechas de calendario como AAAA-MM-DD. Instantes en ISO 8601 UTC.
- La autorización se decide en el servidor con `can(actor, "recurso:accion")`. La interfaz solo oculta.
- Todo cambio de negocio escribe su fila en bitácora dentro de la misma transacción.

## Pruebas
- Lógica pura: Vitest sin base de datos.
- Servicios y API: Vitest contra PostgreSQL real (servicio db_test del compose, perfil test).
- E2E: Playwright por perfil. Accesibilidad con axe.
- Cada CF tiene al menos una prueba automatizada y una captura en docs/capturas.

### Pruebas por secciones (no corras todo de golpe)
- Las pruebas se reparten en 10 secciones por módulo: nucleo, acceso, clientes, catalogo, cotizaciones, ordenes, produccion, inventario, analitica e interfaz. Cada una usa su propia base `seccion_<nombre>_test` (la crea el script).
- Mientras trabajas: `pnpm test:seccion <nombre>` (de 15 a 120 s) o `pnpm test:cambios` (solo lo afectado por tus cambios).
- E2E de una sección: `pnpm e2e:seccion <nombre>` (solo ancho portátil). Los 4 anchos con `--anchos`, solo al cerrar el módulo.
- `pnpm test:secciones` corre todas, una tras otra, con resumen por sección. Es la suite completa de cierre.
- `pnpm test:seccion --lista` muestra las secciones y `pnpm test:verificar-secciones` falla si un archivo de prueba nuevo no tiene sección (agrégalo en `scripts/pruebas/secciones.mjs`).
- La sección `interfaz` abre Edge y es la más lenta: córrela solo si tocas componentes.
- CI corre las secciones en paralelo (un trabajo por sección).
- Antes de cada push: `pnpm ci:local` (unos 8 minutos). Repite en tu equipo lint de todo el repositorio, tipos, compilación, auditoría de dependencias, ciclos, gitleaks, Squawk y las secciones de pruebas. Si pasa, el CI de GitHub pasa. No subas con pasos en rojo. El flujo E2E de GitHub usa `pnpm e2e:seccion` y `scripts/auditoria/visual-docker.sh` por separado.

## Definición de terminado
Un cambio está terminado solo si cumple todo lo que aplica:
- TypeScript, ESLint y Vitest limpios. Build de producción limpio.
- E2E críticos limpios. Capturas revisadas.
- axe sin violaciones bloqueantes. Teclado revisado.
- 0 errores de consola y de red.
- Migración incluida si cambia el modelo.
- Autorización probada en el servidor.
- Transacción revisada si toca varias entidades.
- Bitácora en las operaciones sensibles.
- Trivy sin CRITICAL aceptados por error.
- Docker arranca desde cero (nunca `down -v`).
- Documentación actualizada. Ninguna credencial en git.
Scripts únicos: `check:types`, `check:lint`, `check:unit`, `check:build`, `check:e2e`, `audit:code`, `audit:full`.
Informes de auditoría: `docs/auditoria/<fase>-<parte>.md`.

## Reparto de archivos
Un agente es dueño de sus rutas. Nunca edites archivos de otro agente.
Si necesitas un cambio en un archivo ajeno, descríbelo en tu informe final.
No ejecutes git. El orquestador revisa y hace los commits.

## Entorno
- Puertos solo en 127.0.0.1. App 3000. Base de datos 5442. Base de pruebas 5443.
- Credenciales solo en .env.example. Nunca en el código ni en el repositorio.
- No toques contenedores ajenos (ruta-local-*, omniroute).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
