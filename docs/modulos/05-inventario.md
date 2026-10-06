# Módulo 4: Inventario de materiales

Estado: diseño auditado por Codex y Gemini Pro. Fecha: 2026-10-06.
Criterios de aceptación: CF-03, CF-04. Requerimiento: R-05. Apoya CF-05, CF-06 y CF-09. Alertas de stock: Tabla C2.
Fuentes: tesis V6 secciones 1.7 y 2.6; Anexo C (P5, P8, Tablas C2 y C3); Anexo D (A3, A4).
Supuestos: S-05, S-09, S-16, SD-15, SD-19, SD-20.
Modelo: docs/analisis/05-modelo-datos.md (Material, MovimientoInventario, ConsumoOrden, ConsumoEstimado; invariantes I-01 a I-08, I-19, I-22, I-24).
La base ya garantiza el libro, el saldo y los topes (restricciones.sql, fn_movimiento_aplicar y fn_consumo_validar). El servicio agrega permisos, reglas de estado de la orden, orden de bloqueos, mensajes legibles y bitácora.

## Alcance
Dentro:
- Materiales: alta, edición, archivar, reactivar, lista con existencia, costo promedio y alerta de stock bajo, ficha con libro de movimientos.
- Entradas por compra, ajustes (solo Gerencia), consumo y devolución por orden, consulta del libro global y por material.
- Consumo estimado, consumido, devuelto y neto por orden y material (CF-03), con acciones desde la ficha de la orden.
Fuera de alcance: compras y proveedores, reservas de material, transferencias, lotes, panel y reportes (módulo 7), acciones de etapas (módulo 5).

## Permisos (matriz aprobada)
| Permiso | Gerencia | Ventas | Producción |
|---|---|---|---|
| inventario:ver | sí | sí | sí |
| inventario:entrada | no | no | sí |
| inventario:consumir (consumo y devolución) | no | no | sí |
| inventario:ajustar | sí | no | no |
| material:gestionar (alta, edición, stock mínimo, archivar) | sí | no | sí |
Administración no ve el módulo. Ventas solo consulta. El costo promedio y el valor del inventario son visibles con `inventario:ver`: el inventario no es dinero de cotización y Producción necesita el costo para registrar entradas.
La ficha de la orden muestra cantidades de materiales a todo perfil con `orden:ver` e `inventario:ver`; no muestra costos (el DTO de orden sigue sin dinero).

## Materiales
Campos: código único (30), nombre (160), descripción, unidad (lista cerrada, inmutable después del alta), existencia, costo promedio, stock mínimo, activo.
Reglas:
1. El alta crea el material con existencia 0. La existencia inicial entra con una ENTRADA (la base rechaza otra cosa: SC006).
2. El costo promedio se puede fijar al dar de alta o editar solo mientras la existencia es 0 (precio de referencia para cotizar). Con existencia solo lo mueve una ENTRADA.
3. Archivar exige existencia 0: con existencia se rechaza con 409 MATERIAL_CON_EXISTENCIA. Un material archivado no se ofrece en recetas ni líneas nuevas, no recibe entradas ni consumos. Las recetas y cotizaciones que lo usan lo conservan.
4. Alerta de stock bajo: material activo con stock mínimo mayor a 0 y existencia menor o igual al mínimo. Un material archivado nunca alerta. Se muestra con texto ("Stock bajo", "Sin existencia") y no solo con color. La lista filtra por alerta y su encabezado cuenta los materiales en alerta.
5. Versión optimista (`actualizadoEn`) en PATCH, archivar y reactivar. Las operaciones del libro (entrada, consumo, devolución, ajuste) no exigen versión: el bloqueo de fila del material las serializa (I-03). El trigger del libro no avanza `actualizadoEn`, así que la versión no detecta cambios de existencia: archivar bloquea la fila del material (`FOR UPDATE`), relee la existencia ya bajo el bloqueo y recién entonces decide. Las entradas, consumos, devoluciones y ajustes bloquean el material y validan `activo` bajo el bloqueo.
6. Bitácora entidad MATERIAL: CREAR, EDITAR con valores antes y después, ARCHIVAR, REACTIVAR, en la misma transacción.

## Operaciones del libro
Toda operación escribe en una transacción: movimiento, enlace con la orden cuando aplica y evento de bitácora (I-19). La entidad de bitácora es MOVIMIENTO_INVENTARIO con `entidadId` igual al movimiento; las de orden llevan `ordenId` (obligatorio).
| Operación | Permiso | Movimiento | Bitácora |
|---|---|---|---|
| Entrada por compra | inventario:entrada | ENTRADA, cantidad mayor a 0, costo unitario mayor o igual a 0, referencia (factura o guía) opcional | REGISTRAR_ENTRADA |
| Consumo | inventario:consumir | CONSUMO, cantidad negativa en el libro, enlace en consumo_orden | CONSUMIR_MATERIAL |
| Devolución de sobrante | inventario:consumir | DEVOLUCION, cantidad positiva, enlace en consumo_orden | DEVOLVER_MATERIAL |
| Ajuste | inventario:ajustar | AJUSTE distinto de cero, motivo obligatorio (mínimo 5 caracteres) | AJUSTAR_INVENTARIO |
La interfaz y la API reciben cantidades positivas; el servicio pone el signo. Cantidades con 3 decimales, máximo 99999999999.999. El costo de CONSUMO, DEVOLUCION y AJUSTE lo fija la base al costo promedio vigente (SD-20). El servicio nunca envía costo en esos tipos.
El ajuste lleva `direccion` (AUMENTAR o DISMINUIR) y una cantidad positiva; el servicio pone el signo. DISMINUIR no puede dejar la existencia bajo cero.

### Idempotencia (consumo, devolución, entrada y ajuste)
Toda escritura del libro exige el encabezado `Idempotency-Key` con un UUID generado por el cliente (la interfaz crea uno por formulario). Falta o formato inválido: 422. La tabla `solicitud_idempotente` (clave uuid, usuario, operación, huella SHA-256 del cuerpo canónico, respuesta, fecha) es de solo inserción. Se inserta dentro de la misma transacción de la operación:
- Clave nueva: se ejecuta la operación y se guarda la respuesta.
- Clave existente del mismo usuario, misma operación y misma huella: se devuelve la respuesta guardada con 200 y `repetida: true`, sin tocar el libro.
- Clave existente con otra huella u otra operación: 422 CLAVE_REUTILIZADA. De otro usuario: 409 CLAVE_EN_USO, sin revelar nada.
- Dos solicitudes simultáneas con la misma clave: la segunda espera al INSERT de la primera (llave primaria) y luego responde con la respuesta guardada.
Una solicitud rechazada por reglas de negocio revierte todo, incluida la clave, y se puede reintentar con la misma clave.
Bitácora: `detalle` con material, cantidad, costo unitario, existencia resultante, orden y referencia o motivo.

### Consumo (uso 2b: concurrencia)
POST /api/v1/ordenes/[id]/consumos con `lineas: [{ materialId, cantidad }]` (1 a 50 líneas, material sin repetir). Todo o nada.
Algoritmo, en una transacción:
1. Inserta la clave de idempotencia (ver arriba).
2. Bloquea la fila de la orden con `FOR SHARE` y relee su estado (contrato de bloqueo del módulo 3). Solo PENDIENTE, EN_PRODUCCION y LISTA admiten consumo (I-22). Otro estado: 409 ORDEN_NO_ADMITE_CONSUMO.
3. Ordena las líneas por `materialId` ascendente y bloquea cada material con su propio `SELECT ... FOR UPDATE`, en ese orden (I-24). No usa un solo SELECT con ORDER BY: PostgreSQL no garantiza el orden de los bloqueos en ese caso. Ninguna operación toma un material antes que la orden, y ninguna que actualice la orden retiene materiales.
4. Con todos los materiales ya bloqueados valida con valores exactos: material inexistente 422; archivado 409 MATERIAL_ARCHIVADO; existencia insuficiente 409 EXISTENCIA_INSUFICIENTE con la lista completa de líneas (material, solicitado, disponible). Esos valores son exactos porque nadie más puede mover esos materiales hasta el fin de la transacción. El CHECK de la base queda como respaldo; si aun así dispara (23514), el servicio lo traduce al mismo código.
5. Inserta los movimientos y sus enlaces en el mismo orden ascendente y escribe la bitácora.
6. Advertencia `excedeEstimado`: si el consumo neto (consumido menos devuelto) de un material supera el estimado de la orden, o el material no está en el estimado, el consumo se acepta y la respuesta lo marca. No bloquea: la merma real puede diferir de la prevista. Se compara el neto, no el bruto, porque retirar, devolver y volver a retirar no es un exceso.
7. Respuesta: movimientos creados y estado por material (estimado, consumido, devuelto, neto, existencia).

### Devolución
POST /api/v1/ordenes/[id]/devoluciones con el mismo formato. Estados que la admiten: PENDIENTE, EN_PRODUCCION, LISTA, ENTREGADA y CANCELADA (ajuste de I-22 respecto del modelo, para devolver el sobrante de una orden cancelada, decisión del módulo 3). CERRADA no. Mismo algoritmo: clave, `FOR SHARE` de la orden, bloqueo de materiales ascendente y validación exacta bajo bloqueo.
Tope: lo devuelto no supera lo consumido neto por la orden y material. Lo exige la base (SC005, serializada por el bloqueo del material). El servicio lo calcula bajo el bloqueo del material para dar 409 DEVOLUCION_EXCEDE_CONSUMO con el máximo devolvible exacto por línea.
La devolución reingresa al costo promedio vigente y no lo cambia.

## Consulta
- Libro global: GET /api/v1/movimientos, filtros: material, tipo, orden, usuario, desde y hasta (fecha de Managua), paginado, más reciente primero. Cada fila: fecha, material, tipo, cantidad con signo, costo unitario, existencia resultante, usuario, orden o referencia o motivo.
- Libro por material: GET /api/v1/materiales/[id]/movimientos (misma forma).
- Por orden: GET /api/v1/ordenes/[id]/consumos devuelve por material estimado, consumido, devuelto, neto y los movimientos. Permiso `orden:ver` e `inventario:ver`.
- Conciliación: la ficha del material muestra existencia y la suma del libro con una marca "Conciliado". Se calcula con una sola consulta SQL (misma instantánea) para que un consumo concurrente no produzca un falso defecto. Una diferencia real sería un defecto de integridad y se registra como error.
- Visibilidad de costos ligados a órdenes: el costo unitario y el costo promedio resultante de movimientos CONSUMO y DEVOLUCION (en el libro, en la consulta por orden y en las respuestas de escritura) exigen `cotizacion:ver`. Sin ese permiso esos campos no se envían. Entradas, ajustes y el costo promedio del material siguen visibles con `inventario:ver`.

## API
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /materiales | inventario:ver | Lista paginada. Filtros: texto, activo, bajoMinimo |
| POST /materiales | material:gestionar | 201 |
| GET /materiales/[id] | inventario:ver | Ficha y conciliación |
| PATCH /materiales/[id] | material:gestionar | Nombre, descripción, stock mínimo, costo promedio con existencia 0. Exige version |
| POST /materiales/[id]/archivar, /reactivar | material:gestionar | Exige version |
| GET /materiales/[id]/movimientos, GET /movimientos | inventario:ver | Libro |
| POST /inventario/entradas | inventario:entrada | 201. Exige Idempotency-Key |
| POST /inventario/ajustes | inventario:ajustar | 201. Exige Idempotency-Key y direccion |
| POST /ordenes/[id]/consumos, /devoluciones | inventario:consumir | 201. Exige Idempotency-Key |
| GET /ordenes/[id]/consumos | orden:ver e inventario:ver | Resumen por material |
La ruta existente GET /catalogo/materiales (módulo 2) se conserva para recetas y cotizaciones. Formato de AGENTS.md. Errores nuevos: MATERIAL_CON_EXISTENCIA, MATERIAL_ARCHIVADO, ORDEN_NO_ADMITE_CONSUMO, EXISTENCIA_INSUFICIENTE, DEVOLUCION_EXCEDE_CONSUMO, CLAVE_REUTILIZADA, CLAVE_EN_USO. El módulo traduce por sí mismo el CHECK de existencia (23514) y SC005 a estos códigos: el traductor genérico solo daría VALOR_FUERA_DE_RANGO.

## Pantallas
- /inventario: tarjeta de resumen (materiales, en alerta, sin existencia) y tabla de materiales con existencia, unidad, stock mínimo, costo promedio y estado de alerta. Filtros. Pestaña Movimientos con el libro global.
- /inventario/[id]: ficha con datos, alerta, conciliación y libro del material. Acciones según permiso: Registrar entrada, Ajustar, Editar, Archivar o Reactivar.
- /inventario/nuevo y /inventario/[id]/editar: formulario de material.
- /inventario/entrada y /inventario/ajuste: formularios (material, cantidad, costo o motivo, referencia).
- /inventario/consumo?ordenId= y /inventario/devolucion?ordenId=: formulario con varias líneas. El de consumo propone las líneas del consumo estimado pendiente (estimado menos neto consumido) que se pueden editar o quitar. Muestra la existencia disponible por línea.
- Ficha de la orden: sección "Materiales" con estimado, consumido, devuelto y neto, y los botones "Registrar consumo" y "Devolver sobrante" para `inventario:consumir` cuando el estado de la orden lo admite.
Cumple WCAG 2.2 AA, 4 viewports, sin desborde horizontal. Los formularios no envían dos veces: el botón se deshabilita mientras la solicitud está en curso.

## Invariantes que cubre
I-01 a I-08 (verificados por la base y ejercitados desde el servicio), I-19, I-20, I-22 (con la ampliación de devolución), I-24. CF-03, CF-04, R-05.

## Pruebas
- Unitarias: esquemas zod, normalización de líneas (orden por id, duplicados), reglas de alerta, signo del movimiento.
- Integración (base propia inv_test): alta, edición con versión y regla del costo con existencia 0, archivar con existencia, entradas con costo promedio ponderado exacto, ajuste con motivo, consumo y devolución con enlace y bitácora, estados de orden admitidos y rechazados, existencia insuficiente con reversión total, devolución sobre el tope, exceso sobre el estimado con advertencia, conciliación existencia igual a la suma del libro.
- Concurrencia (obligatoria): N consumidores simultáneos del mismo material con existencia limitada (suma de lo confirmado no supera la existencia; el resto recibe 409); consumos cruzados de dos materiales en orden opuesto sin interbloqueo; consumo contra cancelación de la misma orden (son válidos los dos órdenes secuenciales: consumo y luego cancelación, o cancelación y luego consumo rechazado; nunca un consumo confirmado después de la cancelación); dos devoluciones simultáneas que juntas superan lo consumido; reintentos con la misma Idempotency-Key en serie y en paralelo (un solo movimiento); archivar contra entrada concurrente (no queda material archivado con existencia); entrada concurrente con consumo; bitácora solo de lo confirmado.
- API por perfil: matriz de permisos, 401, 403, 404, 409, 422.
- E2E: Producción registra una entrada y un consumo desde la orden y ve el saldo y la alerta; Gerencia ajusta con motivo; Ventas consulta sin botones; Administración a /sin-acceso; error visible por existencia insuficiente; devolución; axe y desbordes; capturas CF-03 y CF-04 en docs/capturas/inventario.

## Auditoría (2026-10-06)
Auditores de dos proveedores: Codex arquitecto y Gemini Pro. Ninguno halló un defecto alto demostrado; Gemini marcó la idempotencia como alta y Codex como media.
Adoptado:
- Idempotencia con tabla de solo inserción y encabezado obligatorio (ambos). Migración nueva.
- Bloqueo de cada material en orden ascendente antes de validar, para mensajes exactos bajo Read Committed (ambos; Codex además cita el modelo D-03, que preveía ese bloqueo previo).
- Archivar y recibir entradas con bloqueo del material, porque el trigger no avanza `actualizadoEn` (Codex, verificado en restricciones.sql).
- Ajuste con `direccion`, conciliación en una consulta, alerta solo de materiales activos, exceso contra el neto y costos de movimientos ligados a órdenes bajo `cotizacion:ver` (Codex).
- Prueba de cancelación: ambos órdenes secuenciales son válidos (Codex).
- Regla para los módulos 5 en adelante: una operación que actualice la fila de la orden toma `FOR UPDATE` desde el inicio y no retiene bloqueos de materiales. Promover `FOR SHARE` a `UPDATE` después de tomar un material podría cerrar un ciclo (Codex).
Respuestas a las preguntas: devolución en PENDIENTE, EN_PRODUCCION, LISTA, ENTREGADA y CANCELADA y no en CERRADA (ambos); exceso solo con advertencia (ambos); Producción ve entradas, ajustes y costo promedio del material, no costos ligados a órdenes (Codex; Gemini permitía todo el costo, se adopta lo más restrictivo); idempotencia sí (ambos); sin ciclos con los flujos descritos (ambos).
Aislamiento: Prisma usa READ COMMITTED (src/lib/db.ts no fija nivel). Las lecturas previas sin bloqueo pueden quedar obsoletas; por eso se valida bajo bloqueo.
