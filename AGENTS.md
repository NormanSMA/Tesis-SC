# SC Plataforma: guía para agentes

Piloto de la tesis PCE de Norman Smith Martínez Acevedo y Jorge Alí Rodríguez (UAM).
Caso de estudio: Soluciones Creativas, Managua.
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

## Reparto de archivos
Un agente es dueño de sus rutas. Nunca edites archivos de otro agente.
Si necesitas un cambio en un archivo ajeno, descríbelo en tu informe final.
No ejecutes git. El orquestador revisa y hace los commits.

## Entorno
- Puertos solo en 127.0.0.1. App 3000. Base de datos 5442. Base de pruebas 5443.
- Credenciales solo en .env.example. Nunca en el código ni en el repositorio.
- No toques contenedores ajenos (ruta-local-*, omniroute).
