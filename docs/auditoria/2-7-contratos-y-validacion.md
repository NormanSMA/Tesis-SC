# Fase 2.7: contratos y validación (2026-10-12)

Auditor: Codex `revisar` (solo lectura, por muestreo). El orquestador verificó los hallazgos en el código y corrigió los de `src/lib` y `src/core` con prueba primero (`tests/unit/limites-entrada.test.ts`, 3 pruebas en rojo antes y 5 en verde después).

## Sin hallazgos
- Entradas sin zod (GET de `areas`, `permisos`, `configuracion`, `produccion/opciones`, `auth/yo`, `ordenes/opciones`, `salud`): no procesan entrada. `panel` recibe `perfil` sin zod, pero el servicio lo limita a perfiles concedidos (`panel/service.ts:16`).
- Rango y precisión decimal (`core/costeo.ts:94,131`): rechaza negativos, notación científica y desbordes. Cantidades > 0; costos pueden ser 0.
- Arreglos acotados: líneas ≤ 100, ítems ≤ 200 (`cotizaciones/schema.ts:55,57`), movimientos ≤ 50 (`inventario/contrato-orden.ts:13`). Perfiles: enum y unicidad, máximo seis.
- Paginación: `pagina` ≤ 100000 y `porPagina` ≤ 100 en cotizaciones, inventario, admin y órdenes.
- Formato de error único `{ error: { codigo, mensaje, campos? } }` (`errores.ts:71`); el 500 es genérico, sin stack ni SQL (`errores.ts:111`). UUID inválido da 404, JSON vacío 400, tipo equivocado 422.
- Costo de línea enviado por el cliente (`cotizaciones/schema.ts:47`, `costear.ts:85`): valida rango y precisión (`costeo.ts:195`), exige `cotizacion:gestionar` y la bitácora guarda los costos anteriores y nuevos (`auditoria.ts:11`).

## Hallazgos
- P2 cuerpo JSON sin tope (`lib/http.ts:103`): `req.json()` leía cualquier tamaño. Corregido: tope de 1 000 000 de bytes por `Content-Length` y por texto leído; responde 413 `CUERPO_DEMASIADO_GRANDE`. Quedan en `cotizaciones/cuerpo.ts:7` una lectura previa por `clone()`; es P3.
- P2 decimal sin largo máximo (`core/decimal.ts:28`): `"1." + 400 000 ceros` llegaba a `BigInt`. Corregido: `leerDecimal` devuelve `null` si pasa de 64 caracteres.
- P2 textos sin máximo (`cotizaciones/schema.ts:11,29,44,54`, `catalogo/schema.ts:16`, `clientes/schema.ts:65`): en curso (límite 200, 500 o 2000 según el campo).
- P3 reportes sin presupuesto de filas (`reportes/repo.ts:17,49`): con cientos de miles de registros crecen memoria y latencia. Diferido; la empresa maneja decenas de órdenes al mes.
- P3 `Content-Type` ignorado (`http.ts:103`): acepta JSON enviado como `text/plain`. La verificación de origen en POST/PUT/PATCH/DELETE ya cubre CSRF. No se cambia para no romper clientes de prueba.
- Decisión de producto (para Norman): el costo de una línea de material vinculada puede sustituir al costo promedio (`costear.ts:85`). Así un perfil con `cotizacion:gestionar` mostraría un margen mayor que el real. Hoy está permitido, validado y auditado en bitácora; las compras especiales lo necesitan. Opción más estricta: forzar el promedio del servidor en materiales vinculados y permitir costo libre solo en líneas sin material.

## Observación de pruebas
- P3 `tests/unit/produccion-interfaz.test.ts` y `ordenes-interfaz.test.ts` lanzan Edge y el hook `afterAll` expira a 60 s bajo carga (fallo de suite, 26 pruebas verdes). Arreglo: `hookTimeout` mayor o cierre del navegador con límite. Va a la fase 5.
