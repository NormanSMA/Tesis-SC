# Fase 2.3: índices y consultas (2026-10-12)

Dos mediciones: base de demostración (28 clientes) y base desechable `aud_inv_test` con volumen sintético. Scripts: `scripts/auditoria/volumen.sql` y `explain.sql`. El orquestador repitió la corrida y reprodujo las cifras.

## Demostración (decenas de filas)
- 0 claves foráneas sin índice. 5 consultas típicas entre 0,19 y 0,34 ms. Tabla mayor: `bitacora`, 229 filas.
- 55 índices con `idx_scan = 0`: contadores de poco tráfico, no prueba de que sobren. No se borra ninguno.

## Volumen sintético (20 000 clientes, 40 000 cotizaciones, 15 000 órdenes, 150 000 movimientos, 100 000 bitácora)
- Bien: órdenes recientes 0,7 ms; movimientos recientes 0,5 ms; cotizaciones de un cliente 0,2 ms; bitácora de una orden 0,2 ms. Todas con índice.
- P2 `consultarComercial` (`src/modules/panel/consultas.ts:43`): 2013 ms, de los cuales 1805 ms son JIT de PostgreSQL (optimización 998 ms, emisión 712 ms). Con `jit=off` baja a 266 ms (verificado). Supera el límite de 2 s de RNF-01 solo en este volumen, que es muy superior al de la empresa (decenas de cotizaciones al mes).
  Causa: costo estimado de 1,27 millones por barrido de 40 000 filas y 6 recorridos de un CTE; eso activa JIT.
  Arreglo aplicado: `jit=off` en `compose.yaml` (servicios `db` y `db_test`). Requiere recrear el contenedor `db` (`docker compose up -d db`, sin `-v`) en la fase 3.4.
  Arreglo opcional P3: filtrar el rango de 6 meses antes del `LEFT JOIN` y contar por estado en una pasada.
  Regresión: repetir `scripts/auditoria/explain.sql` sobre una base con volumen; g3 debe quedar bajo 500 ms.
- P3 clientes nuevos del panel (g4, 10 ms): el predicado `(creado_en AT TIME ZONE ...)::date` impide el índice. Propuesta, probada en transacción con ROLLBACK: índice `cliente(creado_en)` y consulta por rango (0,24 ms). Se difiere: 10 ms a 20 000 clientes.
- P3 búsqueda de clientes con `ILIKE '%ab%'`: el conteo de paginación recorre 20 000 filas (20 ms). Con `pg_trgm` y GIN baja a 2,7 ms en búsquedas de 3 letras. Se difiere.
- P3 panel operación y producción (12-27 ms): leen todas las órdenes activas por diseño.
- Sin P0 ni P1.

## Límites
- `EXPLAIN` con literales, no con los parámetros preparados de Prisma. Datos sintéticos de 365 días; el panel comercial ve todo el volumen en su ventana de 12 meses (peor caso).
- Lecturas de `perfil_permiso`, `permiso` y `usuario` en cada petición: P3, sin costo a esta escala.
