# Fase 1.1: inventario del sistema (2026-10-11)

Fuente: 3 exploradores (Haiku). El orquestador verificó los conteos y las citas clave en disco.
Es entrada de las fases 2 a 4. Los puntos marcados "candidato" no son hallazgos hasta que la auditoría los confirme.

## Rutas API (verificado)
- 71 `route.ts` y 89 handlers bajo `src/app/api/v1`. Ningún DELETE.
- `manejar` (`src/lib/http.ts:39,69-84`) exige sesión a todo handler salvo `publica: true`.
- Sin `manejar`: `salud/route.ts:3` (esperado). Públicos: `auth/login`, `auth/logout`.
- Solo sesión, sin permiso en `manejar`: `auth/yo`, `auth/cambiar-clave`, `ordenes/opciones`, `ordenes/[id]` PATCH.
- `ordenes/opciones/route.ts:4`: GET sin permiso; el filtro queda en `opcionesOrden(actor)`. Candidato 2.6.
- `ordenes/[id]` PATCH (`route.ts:9-11`): permiso decidido dentro del handler (`orden:gestionar` o `produccion:planificar`). Candidato 2.6.
- Sin zod (solo parámetro o sin entrada): GET de `areas`, `permisos`, `configuracion`, `panel`, `produccion/opciones`, `auth/yo`, `auth/logout`, `salud`.
- Tabla completa ruta × método × permiso: salida del explorador en el scratchpad (`tasks/a6c3bfd2c8127dbfb.output`). Se regenera con `grep` si hace falta.

## Máquinas de estado
- Tabla única en BD: `prisma/sql/restricciones.sql:493-523` (`transicion_valida`) y trigger `fn_validar_transicion` (:525-559). Réplica en la migración `20261011015300` :515-533.
- Espejos TS: cotización `src/modules/cotizaciones/estados.ts:14-18`; orden `src/modules/ordenes/reglas.ts:24-27`; etapa `src/modules/produccion/reglas.ts:5-15`.
- Cotización: BORRADOR → ENVIADA → APROBADA | RECHAZADA | VENCIDA | AJUSTE_SOLICITADO.
- Orden: PENDIENTE → EN_PRODUCCION | CANCELADA; EN_PRODUCCION → LISTA | CANCELADA; LISTA → EN_PRODUCCION | ENTREGADA | CANCELADA; ENTREGADA → CERRADA.
- Etapa: PENDIENTE → EN_CURSO | OMITIDA; OMITIDA → PENDIENTE; EN_CURSO → COMPLETADA.
- Material y usuario: sin enum de estado (`activo`, `bloqueadoHasta`).
- P3 verificado: `restricciones.sql:490` cita `src/core/estados.ts`, que no existe.
- Candidato 2.4: sin prueba de comparación TS/BD para la orden (existen para cotización y etapa: `tests/integration/produccion-servicio.test.ts:119`, `cotizaciones-v9.test.ts:136`).
- Candidato 2.4: cambios de estado con guardas propias, fuera de `exigirTransicion`: `ordenes/estados.ts:36` (omitir etapas), `produccion/estados.ts:19,32`, `produccion/etapas.ts:90`. La BD lo respalda con el trigger.
- Candidato 2.4: `ordenes/repo.ts:75-89` y `produccion/repo.ts:38-48` aceptan `estado` en escritura genérica.

## Linaje del dato
- cliente → cotización (`schema.prisma:518`) → orden (`:599`, `cotizacion_id` UNIQUE; FK compuesta `:615` fuerza el mismo cliente) → etapas (`:698`) → consumo (`:453-455`, FK compuesta a movimiento y material) → bitácora (`:716-730`).
- `consumo_orden` no enlaza a una etapa. Candidato 2.2: decidir si es brecha de trazabilidad o diseño.
- `bitacora.entidad_id` sin FK (`:719`): por diseño polimórfico. Candidato 2.2: eventos huérfanos.

## Transacciones y bloqueos (por cita del explorador)
- Consumo/devolución: advisory lock por clave de idempotencia, FOR SHARE orden y FOR UPDATE materiales en orden ascendente (`inventario/consumo.ts:52`, `consumo-bloqueo.ts:15,27`, `idempotencia.ts:48`).
- Entradas y ajustes: FOR UPDATE material (`inventario/libro.ts:37`, `repo.ts:9`).
- Orden: cambios por UPDATE condicionado a versión (`ordenes/repo.ts:75-89`, verificado). Entregar, cerrar y cancelar no toman FOR: dependen de esa condición.
- Producción: FOR UPDATE orden y etapa (`produccion/escritura.ts:15`, `repo.ts:10,16`).
- Admin: FOR UPDATE en usuario, perfil, permisos y configuración. Auth: FOR NO KEY UPDATE usuario (`auth/service.ts:114,193`).
- Sin FOR explícito: catálogo, clientes y estados de cotización (`cotizaciones/estados.ts:22,51,73`). Candidato 2.5: carreras de versión.
- Trazabilidad: lectura REPEATABLE READ sin bloqueo (`trazabilidad/service.ts:14,24,38`).

## Bitácora
- `registrarEvento` exige transacción (`src/lib/bitacora.ts:30-31`).
- Candidato 2.2: `auth/service.ts:163-166` cierra sesión con `updateMany` sin transacción ni bitácora.
- No verificado por muestra: llamadas de admin y catálogo (solo `grep`).

## Snapshot de precios y costos
- Cotización guarda tasa, subtotal, impuesto y total (`schema.prisma:495-500`). El ítem copia precio base y descripción (`costear.ts:65-66,72`).
- La orden no copia precios ni costos (`conversion.ts:52-55`).
- El consumo estimado usa la receta vigente, sin snapshot (`ordenes/estimado.ts:14-16`, `ordenes/repo.ts:11`). Candidato 2.4: una receta editada cambia el estimado de órdenes abiertas.
- Verificado: el costo unitario de una línea de material puede venir del cliente (`cotizaciones/schema.ts:47`, `costear.ts:85`). Candidato 2.7: confirmar que el rango y el permiso `cotizacion:gestionar` son suficientes.
