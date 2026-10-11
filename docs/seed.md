# Siembra de datos de demostración

Deja la base con datos realistas para recorrer todos los flujos con cada perfil.
Código: `prisma/seed/`. Datos crudos: `prisma/seed/datos/*.json`.
Modelo: `docs/analisis/05-modelo-datos.md`.

## Qué siembra

| Dato | Cantidad |
|---|---|
| Perfiles, permisos y matriz | 6 perfiles, 30 permisos, 62 concesiones |
| Configuración | 5 claves y el marcador `siembra_version` |
| Áreas y categorías | 8 y 8 |
| Plantillas de etapas | 8 plantillas, 32 etapas |
| Usuarios | 10, según `prisma/seed/datos/usuarios.json` |
| Materiales | 33, con costo y stock mínimo |
| Productos y recetas | 34 productos, 29 líneas de receta |
| Clientes | 28, entre personas y empresas |
| Cotizaciones | 15, con 17 ítems y 35 líneas de costo |
| Órdenes de trabajo | 8, con 35 etapas y 21 consumos estimados |
| Libro de inventario | 65 movimientos y 17 enlaces a órdenes |
| Bitácora | 229 eventos |

Los totales salen de los JSON y de la lógica de siembra. `verificar.ts` los comprueba.
Cuente las concesiones en `PERMISOS_POR_PERFIL` de `src/core/permisos.ts`.
Distribución: GERENCIA 10, ADMINISTRACION 14, OPERACIONES 16, ATENCION_CLIENTE 12, PRODUCCION 6, ADMIN 4.
Permita varios perfiles por usuario; la siembra asigna uno a cada usuario.
Consulte [la matriz v9](modulos/09-perfiles-v9.md).

## Cómo ejecutarla

1. Ejecuta `docker compose up -d --build`. El servicio `migrate` siembra solo.
2. Revisa el resultado con `docker compose logs migrate`.
3. Para repetir desde cero, ejecuta `docker compose down -v` y vuelve a levantar.

Ejecución manual contra una base migrada:

```text
pnpm db:seed
pnpm exec tsx prisma/seed/verificar.ts
```

- `DATABASE_URL` debe usar el rol `sc_app`. La siembra no usa el rol dueño.
- Las claves vienen de `SEED_PASSWORD_*` en `.env.example` o en `.env`.
- Una variable ausente detiene la siembra con un mensaje que nombra la variable.
- Cada clave exige 14 caracteres o más.
- La siembra nunca imprime las claves.

## Idempotencia

- La siembra escribe la fila `siembra_version = 1` en `configuracion`.
- Si la fila existe, imprime que la base ya está sembrada y termina con código 0.
- En ese caso no cambia ningún dato y no exige las claves.
- Todo ocurre en una sola transacción. El marcador se escribe al final.
- Un fallo revierte todo. La base queda sin datos a medias.

## Usuarios

Las claves no están en este documento. Cada perfil usa la variable indicada.

| Persona | Correo | Perfil | Variable de clave |
|---|---|---|---|
| Gerardo Jiménez | gerardo.jimenez@solucionescreativas.test | GERENCIA | `SEED_PASSWORD_GERENCIA` |
| Valentina Castro | valentina.castro@solucionescreativas.test | ATENCION_CLIENTE | `SEED_PASSWORD_ATENCION_CLIENTE` |
| Karla Reyes | karla.reyes@solucionescreativas.test | OPERACIONES | `SEED_PASSWORD_OPERACIONES` |
| Luis Mendoza | luis.mendoza@solucionescreativas.test | ADMINISTRACION | `SEED_PASSWORD_ADMINISTRACION` |
| Roberto Díaz | roberto.diaz@solucionescreativas.test | ADMIN | `SEED_PASSWORD_ADMIN` |
| Marco López (jefe de producción) | marco.lopez@solucionescreativas.test | PRODUCCION | `SEED_PASSWORD_PRODUCCION` |
| Gabriel Cortez (impresión) | gabriel.cortez@solucionescreativas.test | PRODUCCION | `SEED_PASSWORD_PRODUCCION` |
| Alfonso Mejía (corte y láser) | alfonso.mejia@solucionescreativas.test | PRODUCCION | `SEED_PASSWORD_PRODUCCION` |
| Humberto Silva (carpintería) | humberto.silva@solucionescreativas.test | PRODUCCION | `SEED_PASSWORD_PRODUCCION` |
| Daniel Ortiz (instalación) | daniel.ortiz@solucionescreativas.test | PRODUCCION | `SEED_PASSWORD_PRODUCCION` |

El modelo no tiene columnas para el cargo ni el área del usuario. La siembra no las guarda.

## Reglas que respeta la siembra

- Corre con `sc_app`. No desactiva triggers ni usa el rol dueño.
- Las fechas se calculan desde hoy en la zona America/Managua.
- Ningún hecho queda en el futuro.
- Los materiales nacen con existencia 0.
- El libro se inserta en orden cronológico global. El trigger calcula existencia y costo promedio.
- Cada consumo y devolución enlaza su orden con `consumo_orden` en la misma transacción.
- La numeración usa `siguiente_numero()`. Sigue el orden de creación de cada documento.
- Cada transición de cotización, orden y etapa escribe su evento con actor y fecha pasada.
- Las cotizaciones nacen en BORRADOR. Luego avanzan por transiciones válidas.

## Cálculos de costeo

Las fórmulas viven en `prisma/seed/calculos.ts`. Son funciones puras con aritmética decimal exacta.
Un módulo de costeo debe reproducir los mismos resultados.
Las pruebas están en `tests/unit/seed-calculos.test.ts`.

| Función | Fórmula |
|---|---|
| `importeLinea` | `round(cantidad × costo × (1 + merma / 100), 2)` |
| `importeCatalogo` por unidad | `round(precio × cantidad, 2)` |
| `importeCatalogo` por m2 | `round(precio × ancho × alto × cantidad, 2)` |
| `importePersonalizado` | `round(costo / (1 − margen / 100), 2)` |
| `totalesCotizacion` | `impuesto = round((subtotal − descuento) × tasa / 100, 2)` |
| `totalesCotizacion` | `total = subtotal − descuento + impuesto` |
| `margenResultante` | `(precio − costo) / precio × 100` sobre los ítems personalizados |

El redondeo es mitad hacia arriba en valor absoluto. Es el de `round` en PostgreSQL.

## Decisiones sobre los datos

| Tema | Decisión |
|---|---|
| IVA | La tasa se guarda como porcentaje: 15.00. El modelo exige 0 a 100 en `tasa_impuesto`. |
| Descuento | Los escenarios no traen descuento. Todas las cotizaciones llevan 0. Las pruebas cubren el descuento. |
| Costo de línea de material | Copia el costo unitario del JSON. Es igual al costo promedio tras las entradas. |
| Fechas de emisión | `diasAtras` fija la emisión. La cotización se crea a las 08:00 y se envía a las 09:00. |
| Aprobada | Se aprueba el día de emisión. La orden se crea 30 minutos después. |
| Rechazada | Se rechaza dos días después de la emisión. |
| Vencida | Vence al día siguiente de la fecha de vencimiento. |
| Categoría principal | Es la categoría del primer ítem. Define la plantilla de etapas. |
| Etapas del escenario | La etapa i del escenario corresponde a la etapa i de la plantilla. Se conserva el nombre del escenario. |
| Etapas sin definir | Se omiten en órdenes LISTA, ENTREGADA, CERRADA y CANCELADA. Quedan pendientes en las demás. |
| Días de una etapa | Cuentan hacia atrás desde hoy. En etapas sin cerrar, `diasFin` es la fecha planificada. |
| Etapas atrasadas | La fecha planificada de una etapa en curso ya pasó. Sirve para probar alertas de atraso. |
| Fecha de entrega | Es hoy más `diasParaEntrega`. Una orden entregada puede tener una fecha futura. |
| Consumo estimado | Suma recetas del catálogo y líneas MATERIAL con su merma. Un registro por material. |
| Responsables | La orden usa el responsable del escenario. El consumo lo registra el responsable de la orden. |
| Actores de bitácora | Atención al cliente cotiza y entrega. Operaciones aprueba con referencia y convierte. Conserve la limitación histórica indicada abajo. |
| Cancelación | Motivo fijo: el cliente canceló antes de iniciar. Las etapas pasan a OMITIDA. |
| Costo promedio | Todas las entradas tienen el mismo costo que la referencia. El promedio no cambia. |

## Cambios en los datos crudos

Tres cambios en `prisma/seed/datos/escenarios.json`.

| Escenario | Cambio | Motivo |
|---|---|---|
| `cot-borrador-001` | Se agregó `ancho: 1` y `alto: 1` al ítem ROT-VIN-001 | El producto se cobra por m2. La base exige medidas (`item_medidas_m2`). |
| `cot-aprobada-004` | Se agregó `ancho: 1` y `alto: 1` al ítem ROT-VIN-001 | Mismo motivo. El consumo de 2.5 m2 del escenario confirma 1 m2 por pieza. |
| `cot-mixta-001` | Se agregó `ancho: 1` y `alto: 1` al ítem ROT-VIN-001 | Mismo motivo. El consumo de 1.5 m2 del escenario confirma 1 m2 por pieza. |

## Movimientos complementarios

Los JSON no traen ajustes ni devoluciones. `inventario-complementario.ts` agrega tres.
Así el libro muestra los cuatro tipos de movimiento.

| Tipo | Material | Cantidad | Orden o motivo |
|---|---|---|---|
| AJUSTE | TAZ-BLA-01 | −4 | Conteo físico: tazas quebradas. Actor histórico: Gerencia; permiso vigente: Administración. |
| AJUSTE | ACR-TRA-01 | +1 | Conteo físico: pliego hallado. Actor histórico: Gerencia; permiso vigente: Administración. |
| DEVOLUCION | PAP-COU-01 | 0.25 | Sobrante de `cot-aprobada-002`. |

La generación de devoluciones por cancelación también existe. Con estos datos no devuelve nada.
La orden cancelada no consumió material.

### Limitación de actores históricos

Distinga actores sembrados de permisos vigentes.
`ordenes.ts` todavía atribuye cierre y cancelación a Gerencia y planificación a Producción.
`inventario.ts` atribuye entradas y consumos a Producción y ajustes a Gerencia.
Estos eventos históricos no conceden permisos para ejecutar esas acciones.
Reserve cierre y cancelación para los perfiles indicados en la matriz v9.
Reserve planificación para Operaciones y Administración; inventario para Administración.
Queda pendiente corregir esos actores en el código de siembra.

## Alertas de stock

Cinco materiales quedan bajo el stock mínimo y uno queda agotado.

| Material | Existencia | Mínimo | Origen |
|---|---|---|---|
| VIN-BLA-01 | 4 | 5 | Los consumos de tres órdenes lo bajan del mínimo. |
| ACM-NEG-01 | 7 | 8 | Existencia inicial bajo el mínimo. |
| TIN-ECO-02 | 3 | 5 | Existencia inicial bajo el mínimo. |
| TIN-ECO-03 | 3 | 5 | Existencia inicial bajo el mínimo. |
| TIN-ECO-04 | 0 | 5 | Agotado. |

Cinco materiales quedan justo en el mínimo. No cuentan como bajo mínimo.

## Escenarios

Los números salen de la última corrida. El año es el de la ejecución. Aquí es 2026.
Las cotizaciones se numeran por antigüedad: la más antigua recibe 0001.

| Escenario | Cotización | Estado | Total (C$) | Orden | Estado de la orden | Demuestra |
|---|---|---|---|---|---|---|
| `cot-vencida-001` | COT-2026-0001 | VENCIDA | 3,565.00 | - | - | CF-05: transición a vencida en bitácora. CF-06: cotizaciones fuera de plazo. |
| `cot-personalizado-001` | COT-2026-0002 | APROBADA | 49,543.05 | OT-2026-0001 | EN_PRODUCCION | CF-10: ítem personalizado de mobiliario con merma, tercero y margen 45%. CF-01 y CF-02: orden con etapa en curso atrasada. CF-03 y CF-04: consumos de aluminio y vinil. CF-06: carga de carpintería. |
| `cot-aprobada-005` | COT-2026-0003 | APROBADA | 33,005.33 | OT-2026-0002 | PENDIENTE | CF-01: orden recién convertida con cinco etapas sin iniciar. CF-02: orden sin responsables de etapa. CF-10: letras corpóreas con LED. |
| `cot-aprobada-001` | COT-2026-0004 | APROBADA | 5,474.00 | OT-2026-0003 | ENTREGADA | CF-05: línea de tiempo completa de una orden. CF-03: consumo igual al estimado. CF-11: trabajos de Panadería Los Andes. |
| `cot-mixta-001` | COT-2026-0005 | APROBADA | 16,496.59 | OT-2026-0004 | LISTA | CF-10: ítem de catálogo por m2 y ítem personalizado en una cotización. CF-03 y CF-04: cinco consumos de materiales. |
| `cot-rechazada-002` | COT-2026-0006 | RECHAZADA | 4,554.00 | - | - | CF-05: motivo de rechazo en bitácora. CF-11: historial del cliente. |
| `cot-aprobada-006` | COT-2026-0007 | APROBADA | 7,935.00 | OT-2026-0005 | CANCELADA | CF-02: cancelación con motivo y etapas omitidas. CF-05: evento de cancelación con actor. |
| `cot-rechazada-001` | COT-2026-0008 | RECHAZADA | 26,450.00 | - | - | CF-06: cotización de monto alto rechazada. CF-11: historial del cliente. |
| `cot-aprobada-002` | COT-2026-0009 | APROBADA | 1,518.00 | OT-2026-0006 | CERRADA | CF-01 a CF-05: recorrido completo hasta el cierre. CF-03 y CF-04: consumo y devolución del sobrante. |
| `cot-aprobada-003` | COT-2026-0010 | APROBADA | 10,695.00 | OT-2026-0007 | EN_PRODUCCION | CF-02, CF-03 y CF-04: orden en producción con consumo. CF-06: etapa en curso asignada a un operario. |
| `cot-enviada-002` | COT-2026-0011 | ENVIADA | 54,028.92 | - | - | CF-10: stand con líneas de material, mano de obra y tercero. CF-06: cotización pendiente de respuesta. |
| `cot-aprobada-004` | COT-2026-0012 | APROBADA | 35,202.32 | OT-2026-0008 | LISTA | CF-10: cotización mixta. CF-06: orden lista para entregar y alerta de VIN-BLA-01. |
| `cot-enviada-001` | COT-2026-0013 | ENVIADA | 17,825.00 | - | - | CF-06: cotización pendiente. Sirve para aprobar y convertir en orden. |
| `cot-borrador-001` | COT-2026-0014 | BORRADOR | 18,975.00 | - | - | CF-10: ítem de catálogo por m2. Sirve para editar y enviar. |
| `cot-borrador-002` | COT-2026-0015 | BORRADOR | 31,812.19 | - | - | CF-10: ítem personalizado en edición con margen 35%. Sirve para duplicar. |

Cobertura de estados:

- Cotizaciones: BORRADOR 2, ENVIADA 2, APROBADA 8, RECHAZADA 2, VENCIDA 1.
- Órdenes: PENDIENTE 1, EN_PRODUCCION 2, LISTA 2, ENTREGADA 1, CERRADA 1, CANCELADA 1.
- CF-07 se recorre iniciando sesión con cada perfil de la tabla de usuarios.

## Choques con la base

| Choque | Resolución |
|---|---|
| La clave `siembra.version` incumple el CHECK `configuracion_clave_formato`, que no admite puntos. | El marcador se llama `siembra_version`. |
| La tasa de IVA 0.15 incumple la escala de `tasa_impuesto` (0 a 100). | Se guarda 15.00 en `iva_porcentaje` y en cada cotización. |
| Tres ítems de catálogo por m2 no traen medidas. | Se corrigieron los datos. Ver Cambios en los datos crudos. |

## Código

| Archivo | Responsabilidad |
|---|---|
| `index.ts` | Punto de entrada de `pnpm db:seed`. Siembra y verifica. |
| `sembrar.ts` | Idempotencia, transacción y orden de la siembra. |
| `entorno.ts` | Lee las claves desde variables de entorno. |
| `cargar-datos.ts` | Carga los JSON y valida su integridad. |
| `catalogos.ts` | Configuración, áreas, categorías, plantillas, usuarios, materiales, productos y clientes. |
| `calculos.ts` | Fórmulas de costeo y totales. |
| `items.ts` | Calcula ítems y líneas de costo de cada escenario. |
| `cotizaciones.ts` | Crea la cotización y la lleva por sus transiciones. |
| `plan-orden.ts` | Planifica etapas y fechas de cada orden. |
| `ordenes.ts` | Crea la orden, sus etapas y sus transiciones. |
| `estimado.ts` | Calcula el consumo estimado. |
| `inventario.ts` | Planifica y ejecuta el libro cronológico. |
| `inventario-complementario.ts` | Ajustes y devolución que no traen los JSON. |
| `verificar.ts` | Comprobaciones internas y tabla resumen. |
| `fechas.ts`, `numeracion.ts`, `bitacora.ts`, `tipos.ts`, `salida.ts` | Apoyo de la siembra. |

## Pruebas

- `tests/unit/seed-calculos.test.ts`: fórmulas, redondeo, descuento e IVA.
- `tests/integration/seed.test.ts`: siembra una base aislada `sc_test_seed` y la destruye al terminar.
- La prueba comprueba lo mismo que `verificar.ts`. También prueba la segunda ejecución y las claves.
