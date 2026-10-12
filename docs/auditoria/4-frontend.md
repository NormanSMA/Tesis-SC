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

## 4.5 Regresión visual
- `e2e/regresion-visual.spec.ts`: 10 pantallas (login, panel de Gerencia y de Producción, lista y ficha de cliente, lista y ficha de cotización enviada, lista y ficha de orden, inventario) con `toHaveScreenshot` y máscaras para fechas, montos y gráficos variables.
- Render estable: `scripts/auditoria/visual-docker.sh` corre Playwright 1.63 dentro de la imagen oficial `mcr.microsoft.com/playwright:v1.63.0-noble` contra la app local. Las líneas base viven en `e2e/instantaneas/` (684 KB).
- Verificado: línea base generada y dos comparaciones seguidas con 10 de 10 verdes. Revisé dos líneas base a ojo (panel de Gerencia, ficha de cotización): máscaras sobre lo volátil y nada más.
- Defectos de la prueba corregidos: claves de siembra no cargadas dentro del contenedor y un selector ambiguo (`Ítems de cotización` aparecía como título y como caption).
- Uso: `bash scripts/auditoria/visual-docker.sh` compara; `--update-snapshots` regenera tras un cambio visual aprobado.

## 4.6 Storytelling (Codex `revisar`, 14 pantallas, sin P1)
- Cumplen las 4 listas (clientes, cotizaciones, órdenes, materiales), las fichas de orden y de material y el alcance del perfil ADMIN. Los 5 paneles cumplen las reglas 1 y 2 (título con conclusión; máximo 4 indicadores, 1 gráfico y la lista de atención).
- P2 tres indicadores del panel enviaban a listas con filtros que no existen y mostraban la lista sin filtrar: `/ordenes?atrasadas=true`, `/ordenes?responsable=sin-asignar` y `/inventario?soloAlertas=true` (`panel/paneles.ts:53,72,119`). Verificado contra los esquemas de consulta. Corregido a `vencidas=true`, `sin-responsable` y `bajoMinimo=true`. Regresión: `tests/unit/panel-destinos.test.ts` valida que cada filtro de cada destino exista en el esquema de su lista (falla con los nombres viejos, pasa con los nuevos).
- P3 diferidos: los indicadores de Operaciones, Atención al cliente, Producción y Administración no traen comparación ni meta (regla 3); los gráficos de esos cuatro paneles no llevan enlace (regla 4); la ficha de cliente no preselecciona al cliente en "Nueva cotización"; en una cotización aprobada sin orden, Atención al cliente no sabe que debe intervenir Operaciones.

## Nota de uso de la regresión visual (2026-10-12)
- Corre solo con `bash scripts/auditoria/visual-docker.sh` (pone `E2E_VISUAL=1`). El resto de las corridas E2E, incluida la de GitHub, la ignoran con `testIgnore` en `playwright.config.ts`: sus imágenes base son de la imagen de Playwright y de una base recién sembrada.
- Reinicie la base de demostración antes de comparar (receta sin `down -v` en `docs/seed.md`). La lista de clientes ahora filtra por un cliente de siembra para no depender de los que crean otras pruebas.
- El flujo E2E de GitHub falló la primera vez que corrió porque ejecutaba también esta regresión (322 pruebas verdes, 1 captura distinta). Corregido.
