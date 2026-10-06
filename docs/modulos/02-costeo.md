# Módulo 2: Motor de costeo variable

Estado: implementado y probado contra la base. Fecha: 2026-10-06.
Criterio de aceptación: CF-10. Requerimiento: R-03. Apoya CF-01 y CF-09.
Decisiones del modelo: D-14, D-15. Supuestos: S-04, S-05, S-15, SD-14, SD-15.

## Alcance
Calcula líneas de costo, ítems de cotización y totales.
Valida las entradas y devuelve errores por campo en español.
No lee ni escribe la base. No conoce Next ni Prisma.
No calcula consumo estimado ni costo promedio de inventario.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `src/core/decimal.ts` | Aritmética exacta con fracciones de `bigint`. Redondeo de PostgreSQL. |
| `src/core/costeo.ts` | Fórmulas, validación y tipos de entrada y salida. Fuente única de verdad. |
| `tests/unit/costeo.test.ts` | Casos fijos, paridad con la siembra y propiedades por muestreo. |
| `tests/integration/costeo-paridad-bd.test.ts` | Inserta los resultados y comprueba que la base los acepta. |

## Representación
Cada valor es una fracción `num / den` de enteros grandes.
Suma, resta, producto y división son exactos.
Solo `redondear` descarta cifras.
Entradas y salidas viajan como cadenas decimales con punto.
Cada salida tiene la escala de su columna en la base.

| Columna | Tipo en la base | Escala de salida | Máximo |
|---|---|---|---|
| Cantidad, horas, ancho, alto | numeric(14,3) | 3 | 99999999999.999 |
| Costo unitario, tarifa, costo de tercero | numeric(14,4) | 4 | 9999999999.9999 |
| Montos: importe, precio, subtotal, total | numeric(14,2) | 2 | 999999999999.99 |
| Porcentajes: merma, margen, tasa | numeric(5,2) | 2 | 100 |

## Redondeo
Usa la regla de `round(numeric, n)` de PostgreSQL.
La mitad se aleja de cero: 0.005 da 0.01.
Redondea solo donde la base guarda un valor.
Los cálculos siguientes usan el valor ya redondeado.

## Fórmulas en orden de cálculo
1. Línea: `importe = round(cantidad × costoUnitario × (1 + merma / 100), 2)`.
2. MANO_OBRA: cantidad = horas y costoUnitario = tarifa. Merma 0.
3. TERCERO: cantidad = 1 y costoUnitario = costo. Merma 0.
4. Ítem personalizado: `costoTotal = Σ importes de línea redondeados`.
5. Ítem personalizado: `importe = round(costoTotal / (1 − margen / 100), 2)`.
6. Ítem personalizado: `precioUnitario = round(importe / cantidad, 2)`.
7. Catálogo UNIDAD: `importe = round(precioBase × cantidad, 2)`.
8. Catálogo M2: `importe = round(precioBase × ancho × alto × cantidad, 2)`.
9. Cotización: `subtotal = Σ importes de ítems`.
10. Cotización: `impuesto = round((subtotal − descuento) × tasa / 100, 2)`.
11. Cotización: `total = subtotal − descuento + impuesto`.
12. Cotización: `margenPct = round((Σ importe − Σ costo) / Σ importe × 100, 2)`.
El paso 12 solo suma ítems personalizados.

Los pasos 1, 7, 8, 10 y 11 son CHECK de `prisma/sql/restricciones.sql`.
El paso 4 lo verifica el trigger `fn_cotizacion_congelar` al enviar.
El paso 9 también lo verifica ese trigger.
Los pasos 5, 6 y 12 no tienen CHECK. La prueba de integración compara el paso 5 con SQL.

## Contrato
| Función | Entrada | Salida |
|---|---|---|
| `costearLinea` | `EntradaLinea` | `LineaCosteada` |
| `costearItemPersonalizado` | `{ cantidad, margenPct, lineas }` | `ItemPersonalizadoCosteado` con sus líneas |
| `costearItemCatalogo` | `{ unidadCobro, precioBase, cantidad, ancho?, alto? }` | `ItemCatalogoCosteado` |
| `totalizarCotizacion` | `{ items, descuento, tasaImpuesto }` | `TotalesCotizacion` |
| `validarLinea`, `validarItemPersonalizado`, `validarItemCatalogo`, `validarCotizacion` | La misma entrada | `CamposError`, vacío si es válida |

`EntradaLinea` depende del tipo:
- MATERIAL: `cantidad`, `costoUnitario`, `mermaPct`.
- MANO_OBRA: `horas`, `tarifa`.
- TERCERO: `costo`.

Cada salida trae los nombres de columna de `linea_costo`, `item_cotizacion` o `cotizacion`.
`totalizarCotizacion` acepta ítems costeados o filas leídas de la base.
Cada ítem necesita `tipo`, `importe` y `costoTotal`.

Las funciones `costear*` lanzan `AppError` 422 `VALIDACION` con `campos`.
Las funciones `validar*` devuelven los mismos `campos` sin lanzar.
Las claves de `campos` indican la ruta: `lineas.1.mermaPct`, `items.0.importe`.
Todas las funciones son puras y deterministas.

## Reglas de validación
| Campo | Regla | Mensaje |
|---|---|---|
| Cualquier número | Cadena decimal con punto | "Debe ser un número decimal con punto, por ejemplo 12.50." |
| Cualquier número | Sin decimales de más | "Admite hasta N decimales." |
| Cualquier número | Dentro de su columna | "No puede superar 99999999999.999." |
| cantidad, horas, ancho, alto | Mayor que 0 | "Debe ser mayor que 0." |
| costoUnitario, tarifa, costo, precioBase | Mayor o igual que 0 | "No puede ser negativo." |
| mermaPct, tasaImpuesto | De 0 a 100 | "Debe estar entre 0 y 100." |
| margenPct | De 0 a menos de 100 | "Debe ser mayor o igual que 0 y menor que 100." |
| ancho y alto con M2 | Obligatorios | "Es obligatorio cuando se cobra por m2." |
| lineas | Al menos una | "Agrega al menos una línea de costo." |
| descuento | De 0 al subtotal | "No puede superar el subtotal (X)." |
| Resultados | Dentro de numeric(14,2) | "El resultado supera el máximo admitido (999999999999.99)." |

Los ceros a la derecha no cuentan como decimales: "1.50000" es válido.

## Uso desde el módulo de cotizaciones
1. Valida la forma del cuerpo con zod. Los números llegan como cadenas.
2. En catálogo, lee `precioBase` y `unidadCobro` del producto. No los toma del cliente.
3. En material, copia `costoPromedio` del material como `costoUnitario`.
4. Llama a `costearItemCatalogo` o `costearItemPersonalizado` por ítem.
5. Llama a `totalizarCotizacion` con todos los ítems del borrador.
6. Guarda las salidas tal cual en la misma transacción.
7. Recalcula los totales en cada cambio de ítem, descuento o tasa.
8. No repite fórmulas. Todo cálculo pasa por `src/core/costeo.ts`.

La tasa se copia de la configuración de IVA vigente (S-04).
El descuento es un monto global, no un porcentaje (SD-14).
`margenPct` de la cotización es nulo sin ítems personalizados.
En el ítem personalizado, unidad de cobro y medidas son descriptivas.
El módulo de cotizaciones valida esas medidas. No cambian el importe.

## Decisiones
**DC-01. Fracciones de `bigint`.**
Dan resultados exactos sin dependencias nuevas.
Descartado `number`: 0.1 + 0.2 no da 0.3.
Descartado `Prisma.Decimal`: acopla `src/core` a Prisma y tiene precisión configurable global.
Descartado entero escalado: la división del margen exige elegir una escala intermedia.

**DC-02. Redondeo solo en los puntos de guardado.**
Reproduce lo que la base guarda y lo que sus CHECK recalculan.
Descartado redondear cada operación: el área por m2 redondeada cambia el importe.
Descartado redondeo bancario: PostgreSQL no lo usa en `round(numeric)`.

**DC-03. Rechazo de decimales de más.**
Una cantidad con cuatro decimales es un error de captura.
Descartado redondear en silencio, como hace la siembra: oculta el error.

**DC-04. Todos los errores a la vez.**
El formulario marca cada campo inválido en una sola respuesta.
Descartado lanzar al primer error: obliga a corregir y reenviar varias veces.

**DC-05. Entrada por tipo de línea.**
MANO_OBRA usa horas y tarifa. TERCERO usa un costo con cantidad 1.
Coincide con la siembra y con el lenguaje del taller.
Descartado cantidad y costo para todo tipo: la interfaz pierde claridad.

**DC-06. Costo total desde importes de línea redondeados.**
El trigger de envío compara `costo_total` con la suma de importes guardados.
Descartado sumar valores sin redondear: el envío fallaría por centavos.

**DC-07. El importe manda sobre el precio unitario.**
En personalizado, `precioUnitario × cantidad` puede diferir del importe por centavos.
El importe conserva el margen pactado. El precio unitario es informativo.
Descartado `importe = precioUnitario × cantidad`: cambia el margen.

**DC-08. Verificación de desbordamiento.**
Un margen de 99.99 multiplica el costo por diez mil.
El motor rechaza resultados que no caben en numeric(14,2).
Descartado dejar fallar el INSERT: el error 22003 llega como 500 ERROR_INTERNO.

**DC-09. Errores con `AppError`.**
Usa el mismo tipo que `src/core/autorizacion.ts`.
El manejador HTTP lo traduce a 422 sin código extra.
Descartado un tipo de error propio: exigiría otra traducción.

## Pruebas
Unitarias: 36 casos. Incluyen 500 muestras con semilla fija por propiedad.
Comparan cada muestra con `prisma/seed/calculos.ts`.
Propiedades: determinismo, total exacto, descuento acotado, monotonía del margen y escalas.
Integración: 6 casos fijos y 40 cotizaciones aleatorias con semilla 20261006.
Cada caso se inserta en BORRADOR, se envía y se revierte.
Dos controles prueban que la base rechaza un centavo alterado.
Comando: `pnpm exec vitest run tests/unit/costeo.test.ts tests/integration/costeo-paridad-bd.test.ts`.

## Pendientes
- P-01: confirmar margen sobre precio. Si cambia, solo cambia el paso 5.
- La siembra aún usa `prisma/seed/calculos.ts`. La migración al motor la decide el orquestador.
- La siembra acepta `number` y redondea entradas. El motor exige cadenas exactas.
