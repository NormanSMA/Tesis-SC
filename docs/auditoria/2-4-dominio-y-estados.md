# Fase 2.4: dominio y estados (2026-10-12)

Auditor: Codex `revisar` (solo lectura). El orquestador verificó las citas de pruebas por muestreo (RB-01, RB-07, RB-09 y la brecha de RB-02) y la lectura de `restricciones.sql`.

## Resultado
- Transiciones: ningún llamador transmite un estado arbitrario. `ordenes/repo.ts:86` y `produccion/repo.ts:48` hacen UPDATE condicionado; las guardas previas están en `ordenes/estados.ts:13,25,48`, `produccion/estados.ts:16,18,30` y `produccion/etapas.ts:83,84,89`. Cotizaciones validan antes y condicionan el UPDATE (`cotizaciones/estados.ts:24,40,53`, `repo.ts:53,56`).
- Única excepción formal: `ordenes/estados.ts:36` (omitir etapas al cancelar) actualiza sin `exigirTransicion`. Se descarta el riesgo: selecciona solo PENDIENTE (`:34`) después de bloquear la orden (`:49`), y el trigger valida PENDIENTE -> OMITIDA.
- Exención de una hora en consumo (`restricciones.sql:442,447`): sin riesgo. La aplicación no fija `creado_en` (`contrato-orden.ts:9`, `consumo.ts:81`, default en `schema.prisma:426`).
- Matriz editable por ADMIN: protegida por catálogo de permisos protegidos (`admin/permisos-schema.ts:21`, `permisos-service.ts:65`), con bitácora transaccional (`permisos-service.ts:41,54,74`) y prueba (`admin-permisos-api.test.ts:152`).
- Cierre de sesión sin bitácora: no es operación sensible. Reduce acceso y conserva `revocadaEn` (`auth/service.ts:163`; `auth-sesion.test.ts:127,156`).

## Cobertura RB-01 a RB-10 (regla -> prueba)
- RB-01 `clientes-servicio.test.ts:59`. RB-03 `costeo-paridad-bd.test.ts:307,317,330`. RB-04 `ordenes-conversion.test.ts:90,97`. RB-05 `ordenes-conversion.test.ts:120`. RB-06 `inventario-concurrencia.test.ts:43`. RB-07 `errores-bd.test.ts:179`. RB-08 `produccion-historial.test.ts:25,100`. RB-09 `produccion-historial.test.ts:69`. RB-10 `permisos.test.ts:68` y `ordenes-api-perfiles.test.ts:55`.
- RB-02 `cotizaciones-servicio.test.ts:19,36` cubre cliente válido y archivado. Falta la prueba directa en base de cotización sin cliente o con cliente inexistente.

## Hallazgos
- P3 RB-02 sin prueba de cliente nulo o inexistente (`docs/trazabilidad.md:100`). La columna es NOT NULL con FK (`schema.prisma:488,604`), así que la base ya lo rechaza; falta la prueba que lo fije.
  Arreglo: prueba SQL en `tests/integration/errores-bd.test.ts` que inserte una cotización con `cliente_id` nulo (espera 23502) y con uno inexistente (espera 23503), sin filas persistidas.
- P3 documentación: `restricciones.sql:490` cita `src/core/estados.ts`, que no existe; corregir el comentario. El espejo TS de la orden no tiene prueba de comparación con la base (existe para cotización y etapa). Arreglo: prueba que recorra los pares de `ordenes/reglas.ts:24-27` contra `transicion_valida`.
- Sin P0, P1 ni P2.
