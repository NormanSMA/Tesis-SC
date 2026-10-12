# Fase 4: frontend (2026-10-12)

Herramientas: prueba E2E de auditoría (`e2e/auditoria-frontend.spec.ts`, Playwright + axe), Lighthouse CLI, auditoría de Codex `revisar` (4.2) y MCP Next DevTools (agregado a la configuración local; se activa al reiniciar Claude Code). El orquestador corrió y verificó cada medición.

## 4.1 Build y errores en ejecución
- `next build` limpio con la configuración nueva (build de la imagen Docker correcto tres veces en esta fase).
- Recorrido por los 6 perfiles en `portatil` (1366) y `tableta` (768): cada entrada del menú y la primera ficha de cada módulo. Resultado final: 12 de 12 pruebas pasan. 0 errores de consola, 0 `pageerror`, 0 respuestas >= 400, 0 violaciones de CSP.
- Hallazgos corregidos durante la fase:
  - P2 `favicon.ico` respondía 404 en todas las páginas (Lighthouse: `errors-in-console` en 8 de 8). Corregido con `src/app/icon.png`.
  - P2 zod 4 sondea `new Function` al validar; con la CSP obligatoria (sin `unsafe-eval`) el navegador reportaba una violación en cada formulario. Corregido con `z.config({ jitless: true })` en `src/instrumentation-client.ts` (se ejecuta antes de hidratar). Verificado: 0 violaciones.
  - P3 las peticiones `_rsc` con `ERR_ABORTED` son cancelaciones normales de prefetch de Next; la prueba las ignora de forma explícita.

## 4.2 Servidor y cliente (Codex `revisar`, sin P0 ni P1)
- Sin hallazgos: las tres páginas con `prisma` directo autorizan antes de leer (`guardia.ts:11`); la sesión se deduplica con `React.cache` (`sesion.ts:14`); `exceljs` y `prisma` no llegan al bundle del cliente; DTO con costos filtrados por permiso.
- P2 consultas en serie en `cotizaciones/[id]/page.tsx:32`. Corregido con `Promise.all`.
- P3 claves por índice en ítems nuevos (`EditorItems.tsx:44`): al quitar una fila intermedia otra heredaba el estado de sus selectores. Corregido con clave local estable; prueba `tests/unit/cotizaciones-editor-claves.test.ts` (3 casos, fallan con la clave anterior).
- P3 diferidos: DTO completos hacia acciones de cotización y orden (`cotizaciones/[id]/page.tsx:44`, `ordenes/[id]/page.tsx:40`); `DetalleTrabajo` y `TablaBitacora` podrían ser componentes de servidor; `EditorItems` recalcula todos los ítems en cada pulsación con hasta 200 ítems.

## 4.3 Accesibilidad
- axe (`wcag2a`, `wcag2aa`) en todas las rutas y fichas por perfil: 0 impactos serious o critical.
- Teclado: el primer foco visible aparece dentro de los 3 primeros Tab; sin desborde horizontal en 1366 ni 768.
- P3 Lighthouse `label-content-name-mismatch` (peso 0): el nombre accesible del enlace de la marca y del menú de usuario no empieza por el texto visible (WCAG 2.5.3). No se cambia: axe no lo marca y el texto visible está en el nombre accesible.

## 4.4 Estados de pantalla
- Cubiertos y verdes: búsqueda sin resultados con estado vacío; ruta prohibida lleva a `/sin-acceso`; cliente con nombre de 190 caracteres sin desborde en lista ni ficha.
- Pendiente de cobertura automática (revisados a mano en el recorrido visual): carga, error de servidor, número muy grande.

## 4.7 Rendimiento web (Lighthouse, escritorio, 8 páginas)
- Rendimiento 99-100, accesibilidad 100, SEO 100, mejores prácticas 92-96 en `/login`, `/panel`, `/clientes`, `/cotizaciones`, `/ordenes`, `/inventario`, `/produccion`, `/reportes`.
- LCP entre 500 y 900 ms; TBT entre 0 y 26 ms; CLS 0 en todas.
- Mejores prácticas 92-96: la diferencia viene del 404 del favicon (corregido) y de `inspector-issues` en login, producción y reportes (a revisar en la fase 5 tras la corrección).

## 4.5 y 4.6
- Regresión visual (4.5) y storytelling (4.6): ver secciones siguientes de este informe.
