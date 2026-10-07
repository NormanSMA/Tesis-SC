# Módulo 6: Trazabilidad

Estado: diseño aprobado por el orquestador. Fecha: 2026-10-07.
Criterios de aceptación: CF-05 (historial de cambios y responsables de cada trabajo) y CF-09 (consulta vinculada). Requerimiento: R-07 (bitácora con cambios, responsables, materiales y costos).
Fuentes: tesis V6 secciones 1.7 y 2.6; Anexo C (P8, Tabla C3); Anexo D (A5, A9).
Modelo: docs/analisis/05-modelo-datos.md (Bitacora, solo inserción, I-16, I-17, I-19). La bitácora ya se escribe en cada módulo, en la misma transacción del cambio. Este módulo la consulta; no agrega migraciones ni escrituras.

## Alcance
Dentro:
- Bitácora global consultable con filtros (Gerencia y Administración).
- Trazabilidad completa de una orden: cliente, cotización, orden, etapas, materiales y costos, con una línea de tiempo unificada de todos los eventos del trabajo.
- Enlaces a la trazabilidad desde la ficha de la orden y la de la cotización.
Fuera de alcance: exportar a archivo, reportes e indicadores (módulo 7), edición o borrado de eventos (la base lo impide: SC001), alertas.

## Permisos
| Permiso | Gerencia | Ventas | Producción | Administración |
|---|---|---|---|---|
| bitacora:ver (bitácora global) | sí | no | no | sí |
| orden:ver (trazabilidad de una orden) | sí | sí | sí | no |
| cotizacion:ver (dinero: costos y valores de los eventos) | sí | sí | no | no |
Sin `cotizacion:ver` ningún dato monetario sale del servidor: se aplica una lista blanca de campos por acción en el detalle de los eventos y se omiten los costos de materiales. Administración ve la bitácora global pero sin dinero.

## Bitácora global
GET /api/v1/bitacora (bitacora:ver). Paginada, más reciente primero. Filtros: entidad, acción, usuario, orden (número), cotización (número), desde y hasta (fecha de Managua, inclusive), texto libre sobre números y nombres vinculados. Cada fila: fecha y hora de Managua, usuario, acción en texto legible, entidad y registro con enlace (orden, cotización, cliente, material, producto, categoría, área; los sin pantalla de detalle se muestran sin enlace), estado anterior a nuevo con etiquetas legibles y un resumen del detalle ("Responsable: A a B", "Cantidad: 3.000", "Motivo: ..."). El resumen sigue la lista blanca.
Pantalla /trazabilidad: filtros arriba, tabla con paginación, estado vacío y error con texto. Los eventos de una orden enlazan a su trazabilidad completa.
Índices: la tabla ya tiene (entidad, entidadId, creadoEn), (ordenId, creadoEn), (cotizacionId, creadoEn), (usuarioId, creadoEn) y creadoEn. No se agregan.

## Trazabilidad de una orden (CF-05, CF-09, R-07)
GET /api/v1/ordenes/[id]/trazabilidad (orden:ver). Devuelve:
1. Cadena vinculada: cliente (nombre, tipo, contacto; RUC y dirección solo con `cliente:ver`), cotización (número, asunto, estado, fechas; totales solo con `cotizacion:ver`), orden (número, estado, responsable, fechas), etapas (nombre, área, estado, responsable, fechas planificadas y reales).
2. Línea de tiempo unificada: todos los eventos de la bitácora del trabajo ordenados por fecha: los de la cotización (por `cotizacionId`), los de la orden y sus etapas y los movimientos de material de la orden (por `ordenId`), con usuario, acción legible y detalle según la lista blanca. Orden estable: fecha, luego id.
3. Materiales: por material estimado, consumido, devuelto y neto (como en el módulo 4). Con `cotizacion:ver` además el costo real: suma de cantidad por costo unitario de los consumos y devoluciones de la orden (valorados al costo promedio vigente al momento, SD-20), por material y total. El cálculo es exacto con la aritmética decimal del núcleo y sale de una sola consulta SQL.
4. Responsables: lista de personas que intervinieron (orden, etapas, eventos), con su rol en el trabajo.
Pantalla /trazabilidad/ordenes/[id] (accesible también desde un botón "Trazabilidad completa" en la ficha de la orden y desde la cotización cuando ya tiene orden) con la cadena arriba, materiales y costos, y la línea de tiempo. Búsqueda en /trazabilidad por número de orden o de cotización lleva a esta pantalla.

## Lista blanca de detalle
Cada acción tiene los campos del `detalle` que se muestran y se traducen a texto: motivo, nombre, cantidad, referencia, material (nombre), cambios antes y después de campos no monetarios (responsable, fecha de entrega, especificaciones, fechas planificadas, nombre de etapa, área). Campos monetarios (costoUnitario, costoPromedio, importes, totales, margen, precios) solo con `cotizacion:ver`. Un campo desconocido nunca se muestra: se omite. La lista vive en un solo archivo del módulo y se prueba con una tabla de acciones.

## Integridad
La inmutabilidad de la bitácora la garantiza la base (trigger SC001 y REVOKE al rol de la aplicación). Una prueba confirma que la aplicación no puede modificar ni borrar eventos. La pantalla global indica "Registro de solo lectura".

## Pruebas
- Unitarias: traducción de acciones y estados a texto, lista blanca por acción (con y sin dinero), esquemas zod de filtros.
- Integración (base propia tra_test): filtros y paginación; permisos por perfil (global: Gerencia y Administración sí, Ventas y Producción 403; trazabilidad de orden: Producción sin dinero, Ventas y Gerencia con dinero, Administración 403); unificación y orden de eventos de cotización, orden, etapas y movimientos; costo real de materiales exacto contra el libro (varios materiales, devolución, costo promedio cambiante); ausencia de dinero en toda la respuesta para perfiles sin `cotizacion:ver` (recorre el JSON completo buscando claves monetarias); RUC y dirección sin `cliente:ver`; inmutabilidad de la bitácora desde el rol de la aplicación.
- API por perfil: 401, 403, 404, 422.
- E2E: Gerencia filtra la bitácora global por una orden E2E y abre su trazabilidad completa; Administración ve la bitácora sin dinero; Ventas abre la trazabilidad desde la ficha de la orden; Producción la ve sin dinero; axe y desbordes; capturas CF-05 y CF-09 en docs/capturas/trazabilidad con 4 tamaños.

## Cierre del módulo (2026-10-07)
Implementación y E2E: Codex (programar). Verificación: orquestador (un solo verificador).
Medido: typecheck y lint limpios; 132 pruebas del módulo verdes; E2E completo 522 verdes más los 7 de trazabilidad repetidos tras corregir un valor esperado mal calculado en la prueba (3.333 por 12.3456 es 41.1478848; la aplicación devolvía el valor correcto).
Cobertura (Jev): CF-05 cubierto (0.89), CF-09 cubierto (1.0). R-01 y R-07 implementados.
