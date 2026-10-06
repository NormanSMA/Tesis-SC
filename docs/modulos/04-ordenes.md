# Módulo 3: Órdenes de trabajo

Estado: diseño auditado por Codex y Gemini Pro. Fecha: 2026-10-06.
Criterios de aceptación: CF-01, CF-02, CF-09. Requerimiento: R-04. Apoya CF-05, CF-06 y CF-11.
Fuentes: tesis V6 secciones 1.2, 1.7 y 2.6; Anexo C (P4, Tabla C3); Anexo D (A1, A2, A9).
Supuestos: S-07, S-08, S-17, SD-13, SD-16, SD-17, SD-18, SD-23.
Modelo: docs/analisis/05-modelo-datos.md (OrdenTrabajo, EtapaPlantilla, EtapaOrden, ConsumoEstimado, secciones c y d).

## Alcance
Dentro: convertir una cotización aprobada en orden, listar y consultar órdenes, editar responsable, fecha de entrega y especificaciones, entregar, cerrar y cancelar.
La ficha de la orden muestra cliente, cotización, ítems, etapas, consumo estimado, línea de tiempo y estado (CF-02, CF-09).
Fuera de alcance:
- Planificar, iniciar y completar etapas, y los cambios de estado EN_PRODUCCION y LISTA que dependen de ellas: módulo 5 (producción).
- Consumo y devolución de materiales: módulo 4 (inventario).
- Tablero y reportes: módulo 7.
La interfaz de las etapas en la ficha es de solo lectura. El módulo 5 agrega las acciones sin cambiar este contrato.

## Permisos (matriz aprobada)
| Permiso | Gerencia | Ventas | Producción |
|---|---|---|---|
| orden:ver | sí | sí | sí |
| orden:crear (convertir cotización) | no | sí | no |
| orden:gestionar (responsable, fecha, especificaciones) | sí | sí | no |
| orden:entregar | no | sí | sí |
| orden:cerrar | sí | sí | no |
| orden:cancelar | sí | no | no |
Administración no ve el módulo. `orden:avanzar` queda para el módulo 5.
Todo dato monetario de la orden (precios, importes, totales, costos, márgenes) exige `cotizacion:ver`. Producción ve cantidades, medidas y materiales, sin dinero (ver Visibilidad).

## Conversión de cotización en orden (CF-01, R-04)
Entra por el detalle de una cotización APROBADA sin orden (botón "Convertir en orden" con `orden:crear`) y por POST /api/v1/ordenes.
La persona solo digita lo que la cotización no trae:
| Dato | Origen |
|---|---|
| Cliente, ítems, líneas, totales, asunto | La orden los lee de la cotización congelada. No se copian |
| Categoría principal | Se propone la del ítem de mayor importe. Se puede cambiar. Define la plantilla de etapas (SD-23) |
| Responsable | Se elige entre usuarios activos del perfil Producción. Obligatorio |
| Fecha de entrega | Obligatoria. No anterior a hoy (hora de Managua) |
| Especificaciones | Opcional. Se propone el asunto de la cotización como texto inicial editable |
Efectos, todos en una transacción:
1. Bloquea la fila de la cotización (`FOR UPDATE`), verifica APROBADA y sin orden (la base lo garantiza también: SC004 y UNIQUE de cotizacion_id). Si la carrera llega al UNIQUE (23505 sobre cotizacion_id), el servicio revierte, consulta la orden ganadora y responde 409 ORDEN_EXISTENTE con su número. No usa el traductor genérico DUPLICADO.
2. `numero = siguiente_numero('ORDEN_TRABAJO')` con formato OT-AAAA-NNNN.
3. Crea la orden en PENDIENTE con `creadoPorId`.
4. Crea las etapas desde las plantillas activas de la categoría, en orden de secuencia, en PENDIENTE y sin responsable. Si la categoría no tiene plantillas activas, la conversión se rechaza con mensaje claro (409 SIN_PLANTILLA): una orden sin etapas no se puede producir.
5. Calcula y guarda el consumo estimado (ver abajo).
6. Escribe una fila CONVERTIR_EN_ORDEN con ordenId y cotizacionId, y filas CREAR por cada etapa.
Convertir dos veces la misma cotización devuelve 409 ORDEN_EXISTENTE con el número de la orden.

### Consumo estimado
Función pura en src/core/consumo-estimado.ts, con los mismos redondeos que el motor de costeo.
- Ítem de catálogo: por cada línea de la receta, cantidad de receta por unidad de cobro multiplicada por la cantidad del ítem. Si el cobro es M2, además por ancho y alto.
- Ítem personalizado: por cada línea MATERIAL con material, cantidad con merma.
- La receta que se usa es la vigente en el momento de convertir, leída dentro de la transacción. Un ítem de catálogo cuya unidad de cobro ya no coincide con la del producto se rechaza con 409 RECETA_INCOMPATIBLE.
- Una línea solo aporta si su `unidad` (texto libre) coincide con la unidad del material (enum). Si no coincide, no se suma: se registra una advertencia por línea y la respuesta de la conversión y la ficha las listan ("Línea X: unidad distinta del material; no se estimó").
- Se suman los aportes por material (UNIQUE ordenId y materialId). Origen RECETA si algún aporte viene de receta; si no, COTIZACION. Se omiten cantidades 0.
- Es una previsión de solo lectura. No reserva ni descuenta existencias.
Debe dar los mismos valores que la siembra (prisma/seed/estimado.ts). Una prueba compara ambas con los datos sembrados.

## Edición
PATCH /ordenes/[id] con `version` (`actualizadoEn`, igual que clientes y cotizaciones): fecha de entrega, responsable y especificaciones. Solo en PENDIENTE, EN_PRODUCCION y LISTA.
- Cambio de responsable: bitácora ASIGNAR_RESPONSABLE con valores antes y después. Otros campos: EDITAR con antes y después.
- Fecha de entrega no anterior a hoy cuando cambia (no se rechaza un valor ya guardado que no cambia).
- El responsable debe ser usuario activo con perfil Producción.
- Un PATCH sin cambios reales no avanza la versión ni escribe bitácora (lección del módulo 2).

## Transiciones del módulo
| Desde | Hacia | Permiso | Regla |
|---|---|---|---|
| LISTA | ENTREGADA | orden:entregar | fechaEntregaReal = ahora |
| ENTREGADA | CERRADA | orden:cerrar | fechaCierre = ahora |
| PENDIENTE, EN_PRODUCCION, LISTA | CANCELADA | orden:cancelar | Motivo obligatorio (mínimo 5 caracteres). Ver cancelación |
Toda transición exige `version`, usa UPDATE condicionado a id, estado y versión, y escribe CAMBIAR_ESTADO con estado anterior y nuevo en la misma transacción. La base valida la transición (fn_validar_transicion).

### Cancelación
- Las etapas PENDIENTE pasan a OMITIDA con el motivo de la orden en `observaciones`, una fila CAMBIAR_ESTADO por etapa.
- Las etapas EN_CURSO se dejan como están: la base no permite EN_CURSO a OMITIDA (fn_validar_transicion) y OMITIDA exige fechas reales nulas, lo que borraría la evidencia del inicio. Quedan como historial interrumpido. Los servicios de producción (módulo 5) exigen orden no terminal para cambiar una etapa, y el tablero excluye órdenes terminales.
- La cancelación no depende del inventario: se permite con consumos ya registrados, que se conservan. La devolución del sobrante la hace el módulo 4, que también debe permitir DEVOLUCION en órdenes CANCELADA (ajuste de I-22 que se registra en ese módulo). El modelo describía una devolución automática; se reemplaza por una acción explícita porque lo consumido y usado no es sobrante.
- Contrato de bloqueo para los módulos 4 y 5: toda escritura hija (consumo, devolución, etapa) toma `FOR SHARE` sobre la fila de la orden y revalida el estado después de adquirirlo. La cancelación toma el bloqueo exclusivo con su UPDATE condicionado. Así una cancelación y un consumo concurrentes no confirman ambos.

## Visibilidad de datos
- Precio unitario, importe, subtotal, IVA, total, costos de líneas, margen y costo total solo con `cotizacion:ver`. Un permiso gobierna todo el dinero.
- Sin `cotizacion:ver` el servidor arma un DTO distinto, con campos permitidos explícitos (lista blanca): no recorta un DTO completo. Aplica a ítems, líneas, consumos y al `detalle` de los eventos de bitácora de la línea de tiempo (que puede traer importes y costos). Sin `cotizacion:ver`, el evento muestra acción, estados, actor, fecha y motivo.
- El número de la cotización se muestra sin enlace cuando falta `cotizacion:ver`.
- El cliente se muestra con nombre, tipo, teléfono y correo. RUC y dirección solo con `cliente:ver`.
- Producción ve especificaciones, ítems con cantidades y medidas, etapas y consumo estimado.

## API bajo /api/v1/ordenes
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /ordenes | orden:ver | Lista paginada. Filtros: estado, responsable, cliente, texto (número, cliente, asunto), vencidas (fecha de entrega pasada y no terminal), terminales |
| POST /ordenes | orden:crear | 201. Cuerpo: cotizacionId, categoriaId, responsableId, fechaEntrega, especificaciones |
| GET /ordenes/[id] | orden:ver | Orden con cliente, cotización, ítems, etapas, consumo estimado y línea de tiempo |
| PATCH /ordenes/[id] | orden:gestionar | Responsable, fecha, especificaciones. Exige version |
| POST /ordenes/[id]/entregar | orden:entregar | Exige version |
| POST /ordenes/[id]/cerrar | orden:cerrar | Exige version |
| POST /ordenes/[id]/cancelar | orden:cancelar | Exige version y motivo |
| GET /ordenes/opciones | orden:crear u orden:gestionar | Responsables elegibles y categorías activas con número de etapas |
Formato de AGENTS.md: dinero y cantidades como cadena decimal, fechas de calendario AAAA-MM-DD, errores `{ error: { codigo, mensaje, campos } }`. Orden inexistente: 404. Versión vieja: 409 CONFLICTO_EDICION. Campos inválidos: 422.

## Pantallas
- /ordenes: tabla con número, cliente, categoría, estado (con insignia), responsable, fecha de entrega y señal de atraso. Filtros por estado, responsable y texto. Filas de vencidas marcadas con texto, no solo con color.
- /ordenes/[id]: encabezado con número, estado y acciones permitidas al perfil; bloques de cliente, cotización (enlace), fechas, especificaciones, ítems, etapas (nombre, área, estado, responsable, fechas plan y reales), consumo estimado (material, cantidad, unidad) y línea de tiempo de la bitácora.
- /ordenes/nueva?cotizacionId=: formulario de conversión con los datos propuestos.
- /ordenes/[id]/editar: responsable, fecha y especificaciones.
- Cotización aprobada: botón "Convertir en orden" o enlace a la orden existente. Ficha del cliente: enlaces a órdenes (cierra CF-11 y R-13).
Cumple WCAG 2.2 AA, 4 viewports, sin desborde horizontal.

## Bitácora
Entidad ORDEN_TRABAJO (ordenId = entidadId): CONVERTIR_EN_ORDEN, EDITAR, ASIGNAR_RESPONSABLE, CAMBIAR_ESTADO. Entidad ETAPA_ORDEN: CREAR y CAMBIAR_ESTADO en la cancelación. La línea de tiempo lee por (ordenId, creadoEn) y se ve con `orden:ver`, sin `bitacora:ver`.

## Invariantes que cubre
I-09, I-10, I-11, I-14, I-15, I-17, I-18, I-19, I-20. CF-01, CF-02, CF-09.

## Pruebas
- Unitarias: consumo estimado (catálogo UNIDAD y M2, personalizado con merma, suma por material, origen), reglas de cancelación y de edición, esquemas zod.
- Integración (base propia ord_test): conversión completa con etapas y estimado; doble conversión (409); cotización no aprobada (SC004 traducido a 409); categoría sin plantillas; concurrencia de dos conversiones simultáneas de la misma cotización (una gana, la otra 409); versión vieja; transiciones válidas e inválidas; cancelación con etapas PENDIENTE y EN_CURSO; cancelación con consumo pendiente; bitácora en la misma transacción y fila por evento; paridad del estimado con la siembra; DTO sin costos para Producción.
- API por perfil: matriz de la tabla de permisos, 401, 403, 404, 409, 422.
- E2E: Ventas convierte una cotización aprobada nueva y ve la orden con etapas y estimado; segunda conversión bloqueada; Gerencia edita y cancela; Producción ve sin costos ni botones de gestión; Administración a /sin-acceso; axe y desbordes; capturas CF-01, CF-02 y CF-09 en docs/capturas/ordenes con 4 tamaños.

## Auditoría (2026-10-06)
Auditores de dos proveedores: Codex arquitecto y Gemini Pro. Ninguno halló severidad alta.
Adoptado (coincidencia o verificado en el código):
- UNIQUE de cotizacion_id traducido a 409 ORDEN_EXISTENTE con bloqueo previo de la cotización (ambos).
- DTO de lista blanca sin dinero para perfiles sin `cotizacion:ver`, incluido el detalle de la bitácora (ambos; Codex agregó la bitácora).
- Cancelar no depende del inventario ni bloquea por consumo (Codex: un consumo usado no es sobrante; Gemini: el inventario no existe aún).
- Etapas EN_CURSO se conservan al cancelar. Codex: OMITIDA exige fechas reales nulas (restricciones.sql:198) y borraría la evidencia. Gemini proponía una migración; no se adopta.
- Reasignar el responsable de la orden no reasigna etapas (ambos).
- Estimado: unidades incompatibles se advierten y no se suman; receta vigente al convertir (Codex, verificado: `linea_costo.unidad` es texto libre y `material.unidad` es enum).
- Contrato de bloqueo de la fila de orden para los módulos 4 y 5 (Codex).
- Cotización sin enlace para quien no tiene `cotizacion:ver` (Codex).
Divergencias resueltas:
- Categoría sin plantillas: Codex rechaza, Gemini crea la orden con alerta. Se rechaza (409 SIN_PLANTILLA): una orden sin etapas pasaría a LISTA sin trabajo (regla I-21 vacía). Las 8 categorías sembradas tienen plantilla. A confirmar con el usuario.
- Precios para Producción: Codex los muestra, Gemini los oculta. Se ocultan (mínimo privilegio, un solo permiso para el dinero). A confirmar con el usuario.
- Fecha pasada: se valida solo cuando el campo cambia (Codex). Editar el responsable de una orden vencida no exige reprogramar.
Pruebas agregadas: cancelar contra consumir y contra iniciar etapa (cuando existan los módulos 4 y 5), entregar contra retrabajar, conversiones simultáneas, bitácora solo del ganador y reversión completa.
