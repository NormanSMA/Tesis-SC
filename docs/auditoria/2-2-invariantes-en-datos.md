# Fase 2.2: invariantes en datos (2026-10-12)

Script: `scripts/auditoria/invariantes.sql` (26 consultas INV-01 a INV-26, solo `SELECT` dentro de `BEGIN READ ONLY ... ROLLBACK`). Escrito y ejecutado por el `implementador`; el orquestador repitió la corrida y leyó las consultas clave.

## Resultado
- Base de demostración `sc_plataforma`: 26 de 26 consultas devuelven 0 filas. Corrida en menos de 1 s.
- La base no está vacía: 80 cambios de estado en bitácora, 15 cotizaciones, 8 órdenes, 65 movimientos, 1 ADMIN activo.
- Verificado: el script no contiene `INSERT`, `UPDATE`, `DELETE` ni DDL.

## Cobertura
- Huérfanos de bitácora, de `historial_etapa` y de movimientos (INV-01 a 03).
- Existencia contra libro y existencia acumulada por movimiento (INV-04 a 06).
- Signos de movimiento, consumos y devoluciones coherentes con su movimiento (INV-07 a 10).
- Estados imposibles de orden y etapa (INV-11 a 16).
- Aprobación completa y cliente de la orden igual al de la cotización (INV-17 y 18).
- Totales de cotización contra sus ítems y líneas, excluyendo BORRADOR (INV-19 a 21).
- Bitácora: cambios de estado con estado anterior, nuevo y actor; estado actual contra el último evento (INV-22, 23).
- Usuarios: activos sin perfil y ADMIN activos igual a 0 (INV-24, 25). Orden sin etapas (INV-26).

## Hallazgos
- Sin P0, P1 ni P2 en los datos.
- P3: el modelo de datos documentado (`docs/analisis/05-modelo-datos.md`) difiere del esquema real (varios perfiles por usuario, `usuario_perfil`, aprobación con referencia, `historial_etapa`, consumo con cantidad y costo propios). Actualizar el documento en la fase 5.
- Limitación: los datos de demostración vienen de una siembra que ya cuadra y de triggers y CHECK de la base. Un 0 prueba que no hay corrupción hoy, no que las consultas detecten cada caso. El script debe repetirse sobre la base después de la suite E2E y de la prueba de concurrencia (2.5).
- Arreglo propuesto: enlazar el script desde `audit:full` y ejecutarlo en la fase 5.
