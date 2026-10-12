# Fase 2.5: transacciones y concurrencia (2026-10-12)

Prueba: `tests/integration/concurrencia-cruzada.test.ts` (Codex `programar`; el orquestador corrigió un fixture y la corrió con la base `aud_conc_test`).

## Cobertura previa (verificada por el autor con grep de `Promise.all`)
- Ya probadas: conversión duplicada a orden (`ordenes-conversion.test.ts:120-135`), consumo contra cancelación en ambos órdenes de bloqueo (`inventario-concurrencia.test.ts:74-153`), consumidores simultáneos, idempotencia, entradas y ajustes, edición y entrega duplicadas de la orden, inicios y completados de etapa, consumo contra marcar lista, ediciones de cliente, catálogo y cotización, último ADMIN, bloqueo de login.

## Carreras nuevas (3 pruebas, varias rondas cada una, orden de lanzamiento alternado)
- Entregar contra cancelar la misma orden: gana una; estado final coherente con bitácora e historial.
- Marcar lista contra iniciar una etapa pendiente: la orden nunca queda LISTA con etapas sin cerrar; un solo evento de etapa.
- Aprobar contra archivar la misma cotización: gana una; sin orden creada; un solo evento de bitácora.

## Resultado
- 3 de 3 pruebas pasan. Sin P0, P1 ni P2 en transacciones y concurrencia.
- Fallo inicial de la prueba 5: fixture sin ítems (error de prueba, no del producto). Corregido con `itemUnidad`.
- El riesgo del `arquitecto` ("actualización al mismo estado pasa el trigger", `restricciones.sql:532-533`) queda cubierto en la práctica por la comprobación de versión: la doble respuesta sobre la misma cotización produce un solo ganador.

## Observaciones P3
- Dos devoluciones simultáneas que superan lo consumido: la cubren `inventario-concurrencia.test.ts` y el trigger SC005 (`restricciones.sql:452-460`). Sin prueba cruzada nueva.
- El cierre de sesión (`auth/service.ts:163-166`) escribe sin transacción ni bitácora. Fuera de alcance de concurrencia; pasa a la parte 2.4.
- La validación de estado en consumo solo rige para movimientos de la última hora (`restricciones.sql:442,447`). Pasa a la parte 2.4.
