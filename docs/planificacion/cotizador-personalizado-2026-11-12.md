# Propuesta de automatización de cotizaciones personalizadas

Fecha: 12 de noviembre de 2026. Estado: planificación para revisión. No implementado. No se modificaron código, configuración, documentos originales ni datos de Inventario.

## Decisión propuesta

Extender el cotizador existente con plantillas por familia de trabajo y componentes calculables. Conservar la edición manual y la explicación de cada cantidad. La geometría, las unidades comerciales, los costos operativos y la decisión del precio deben ser explícitos. No convertir los siete presupuestos en siete productos de precio fijo ni importar sus fórmulas sin revisión.

Fuentes: insumos-cliente/PRESUPUESTOS VARIADOS.xlsx, catálogo activo de materiales consultado en modo lectura y código actual de cotizaciones, costeo, medidas e instalación. Se revisaron fórmulas y valores almacenados del Excel; no se recalculó el archivo con Excel. No hay errores Excel almacenados detectados, lo que no demuestra coherencia de unidades, conceptos o alcance.

## Estado recibido de Claude

El último lote documentado comprende COT-17 y COT-18 (profundidad opcional y limpieza del listado), ORD-08 y ORD-09 (materiales por etapa y ajustes de ODT), PROD-06 y PROD-07 (consulta restringida de trazabilidad y tablero), GEN-05 (interfaz y paleta). La migración nueva es 20261112100000_profundidad_partidas. La documentación refiere 3303 pruebas, tipos, lint, compilación y despliegue; no se repitieron estas verificaciones durante esta planificación. Los E2E completos siguen pendientes en copia aislada.

La fórmula nueva de profundidad está en src/core/medidas.ts: ancho × alto + 2 × profundidad × (ancho + alto). Actualmente se aplica también a las líneas de material por área y al consumo estimado. Es una caja abierta, no un modelo universal de fabricación.

## Lo que muestra el Excel

Tiene siete hojas con presupuestos y una vacía. Los siguientes resultados son valores históricos guardados; los importes de costo incluyen los conceptos activados en cada hoja.

| Caso | Venta C$ | Costo del bloque principal C$ | Margen sobre venta |
|---|---:|---:|---:|
| Fascia publicitaria 3,10 × 0,70 | 7.450,00 | 5.112,90 | 31,37 % |
| Ferretería Calderón | 26.000,00 | 19.903,40 | 23,45 % |
| Fascia con lámina lisa | 55.500,00 | 37.861,00 | 31,78 % |
| Mantenimiento Neurofarma | 18.000,00 | 12.956,00 | 28,02 % |
| Marquesina Santa Fe | 63.500,00 | 46.848,20 | 26,22 % |
| Señales de tránsito | 1.100.000,00 | 785.934,50 | 28,55 % |
| Rótulo luminoso La Delicia | 12.500,00 | 8.866,00 | 29,07 % |

El precio se introduce primero y se calcula el margen restante. La automatización debe ofrecer tanto precio sugerido por margen objetivo como precio negociado y margen resultante.

Hallazgos que impiden una importación ciega:

- La columna D se titula Costo Unitario, pero se multiplica por el costo de C: funciona como cantidad o factor. No especifica la unidad.
- El archivo mezcla materiales, impresión, terceros, mano de obra, renta y gastos en un único listado.
- Soldadura: C$150, C$170 y C$1.350. La explicación del usuario sobre libra y caja apunta a presentaciones diferentes; no se conoce la equivalencia. No asumir que sean variaciones del mismo precio unitario.
- Disco de corte de 14 pulgadas: C$200 y C$420. PVC de 3 mm aparece repetido con diferentes valores sin identificar presentación. Acrílico genérico tampoco identifica grosor.
- Se usan conversiones de moneda de 37, 36,6242, 36,6243 y 34,5 en distintos cálculos. Se necesita un tipo de cambio identificado y congelado para cada cotización, con moneda de origen por referencia.
- Fascia publicitaria: E73 suma el bloque principal. La Delicia: E67 suma el principal, mientras E81 calcula C$7.260 de gastos adicionales que C8 no resta al calcular margen. Si ambos bloques corresponden a la misma oferta, el costo sería C$16.126 frente a C$12.500 de venta. Antes de conciliarlos debe confirmarse si el segundo es otro escenario o un gasto del mismo trabajo.
- Señales: L55 suma 329 señales; M55 suma agrupaciones y da 316. Revisar qué grupos omite o representan otro alcance; no usar ambos como cantidad equivalente.
- Hay auxiliares que parecen fórmulas pero son texto, por ejemplo O70:O86 de Santa Fe. No se consideran cálculos activos.
- Las filas de área L21 en varias hojas omiten las primeras filas con medidas. Aunque no alimentan el costo principal en esos ejemplos, deben distinguirse de los totales realmente usados.
- La renta histórica varía entre C$200, C$600, C$1.000 y C$1.500. Hay mano de obra, horas extras e imprevistos repetidos que pueden duplicarse si se activan sin controlar su alcance.

## Reglas confirmadas por el usuario

- La renta se asigna según el trabajo; C$1.500 es una referencia, no un cargo obligatorio universal ni un prorrateo mensual automático.
- La mano de obra corresponde a horas de trabajo por persona. Se capturan horas, personas y tarifa por hora; las tarifas históricas no se convierten en valores vigentes automáticamente.
- Los imprevistos y los impuestos internos indicados se calculan sobre el precio final de venta.
- Traslado: C$16 por kilómetro recorrido, ida y vuelta. No cambia cotizaciones previas.
- Imprevistos: elegir explícitamente 5 % o 6 % para trabajos locales; 10 % fuera de Estelí. Sustituyen como política propuesta el 7 % histórico del Excel.
- Impuestos internos: 0 %, 2 % o 3 % según corresponda; la aplicación no decide la obligación tributaria. Su tratamiento interno se configura aparte del impuesto que pudiera mostrarse al cliente.
- Esta entrega es planificación. La carga de materiales se propone y no se ejecuta.

## Plantillas por familia y componentes

Primera versión recomendada: fascia plana con estructura, rótulo luminoso rectangular, rótulo con poste y mantenimiento de rótulo. Las marquesinas compuestas y los lotes de señalización heterogénea entran después de validar estas familias. Esas plantillas pertenecen al cotizador y son diferentes de las plantillas de etapas de Producción.

Cada plantilla ofrece componentes opcionales: frente impreso, soporte, laterales, estructura, fijación, iluminación, pintura, fabricación e instalación. Cada componente indica material o servicio, área de ejecución, cantidad calculada, unidad, tarifa y explicación. El usuario puede sustituir el material o ajustar una estimación, con motivo registrado.

Ejemplo de rótulo luminoso de 1,25 × 1,25 × 0,20 m, dos caras:
- Impresión de dos frentes: 1,25 × 1,25 × 2 = 3,125 m².
- Soporte transparente: área de los frentes, con su propio material y merma.
- Laterales: 2 × (1,25 + 1,25) × 0,20 = 1 m².
- Marcos: perímetro × número de marcos; refuerzos y postes se definen aparte.
- Iluminación: número de luminarias, longitud de cinta, fuente y cableado según diseño técnico.

Así se reutilizan las medidas del trabajo sin aplicarle a todos los materiales una misma superficie. Para letras o contornos irregulares, el área rectangular es una estimación comercial identificada; el consumo real puede exigir un aprovechamiento o dato de corte distinto. No inferirlo del texto de la descripción.

## Cantidades y aprovechamiento

| Componente | Base de cálculo | Revisión necesaria |
|---|---|---|
| Impreso y laminado | Área de caras seleccionadas × piezas | Sangrado, empalmes y cobertura |
| Lámina de soporte | Área necesaria más merma | Formato disponible y cortes que caben |
| Tubos y perfiles | Perímetro, refuerzos y postes en metros | Longitud comercial y plan de corte |
| Pintura | Superficie pintable × manos / rendimiento por galón | Rendimiento y caras realmente pintadas |
| Soldadura | Cantidad estimada por uniones o trabajo | Coeficiente validado por Taller |
| Tornillos, anclajes y LED | Cantidad por fijación o diseño | Distribución y requerimientos técnicos |
| Discos y brocas | Desgaste estimado o reposición completa | No confundir fracción de costo con media herramienta física |
| Mano de obra | Suma de horas por persona × tarifa por hora | Área, tarea, horas normales y extras |

No basta dividir área útil por área de una lámina para saber cuántas comprar: las dimensiones y orientación pueden impedir los cortes. Lo mismo ocurre al dividir metros necesarios entre longitud del tubo. La primera versión muestra una propuesta editable; la optimización de cortes puede incorporarse después. El sistema no sustituye la revisión estructural, eléctrica o de instalación del responsable técnico.

Separar cantidad útil, merma, equivalente comercial, compra necesaria y consumo real. Los retazos reutilizables conservan dimensiones y existencia si se implementa ese seguimiento. Una cotización no descuenta stock; la ODT guarda el estimado y los movimientos registran el uso real.

## Gastos del trabajo

- Renta asignada: monto manual por pedido con referencia C$1.500 y posibilidad de cero explícito.
- Traslado: distancia de ida por carretera × 2 × número de viajes × C$16/km. Viajes de medición, compra e instalación separados si existen; no sumar también un monto global de camioneta por el mismo recorrido.
- Viáticos: personas × días × tarifa diaria, o gastos específicos si corresponde.
- Hospedaje: personas × noches × tarifa, o habitaciones × noches × tarifa si esa es la forma de compra.
- Mano de obra: horas por persona y tarea; si las tarifas difieren, sumar las líneas individuales. No multiplicar por personas una tarifa que ya corresponde al equipo.
- Horas extra, servicios de terceros y equipos alquilados como conceptos distintos y opcionales.
- Los gastos compartidos se cargan una sola vez por pedido. Si se distribuyen entre partidas para la proforma, la suma distribuida debe coincidir con el cargo original.

La instalación actual suma mano de obra y km × tarifa al total ya calculado. La nueva versión debe integrar esos costos en la rentabilidad y definir cómo participan en descuentos e impuestos, en lugar de depender de un agregado final separado.

## Precio y margen sin circularidad

Definir C como todos los costos fijos estimados del trabajo, incluidos materiales, fabricación, instalación, renta y viajes, excluyendo los cargos calculados como porcentaje de la venta. Definir m como margen objetivo, r como imprevistos y t como impuestos internos, expresados como fracciones.

Si los tres porcentajes tienen exactamente la misma base P:

P = C / (1 - m - r - t)

Ejemplo ilustrativo, no tarifa acordada: C = C$10.000, m = 30 %, r = 10 %, t = 2 %. Precio sugerido = C$17.241,38; imprevistos = C$1.724,14; impuestos internos = C$344,83; utilidad restante = C$5.172,41. No sumar los mismos porcentajes otra vez al precio obtenido. Validar que m + r + t sea menor que 100 %.

En precio negociado: utilidad = P - C - rP - tP; margen real = utilidad / P. Mostrar advertencia si el descuento o el precio manual dejan el margen bajo el mínimo autorizado. Distinguir margen sobre venta de recargo sobre costo.

Queda por definir si el precio final que indicó el usuario es el importe neto después de descuentos y antes de cualquier impuesto trasladado al cliente. Propuesta: usar esa base neta para rentabilidad y tratar cualquier impuesto trasladado por separado; si la base requerida incluye otros cargos, adaptar la fórmula y etiquetarla explícitamente. No interpretar automáticamente IR/alcaldía como IVA, recargo al cliente o retención.

## Plan de Inventario

La consulta de lectura encontró 235 materiales activos. No se modificó ninguno. Ya hay PVC y acrílico por espesor y presentación, viniles y reflectivos; no duplicarlos por usar nombres abreviados del nuevo Excel. No se encontraron coincidencias claras de los tubos, soldadura, pintura o discos prioritarios en los nombres del catálogo consultado.

| Prioridad de Taller | Unidad de control propuesta | Información que falta |
|---|---|---|
| Tubo cuadrado 3/4, calibre 16 | Metro, con barra como presentación | Largo comercial, acabado, costo por barra |
| Tubo cuadrado 1 pulgada, calibre 16 | Metro, con barra como presentación | Largo comercial, acabado, costo por barra |
| Tubo redondo 2 pulgadas, calibre 16 | Metro, con barra como presentación | Largo comercial, acabado, costo por barra |
| Soldadura Lincoln 6013 delgada | Libra, con caja como presentación | Diámetro y libras por caja |
| Pintura Fast Dry | Galón, con fracciones | Color, presentación y rendimiento |
| Tornillos | Unidad; paquete como presentación | Tipo, longitud, diámetro y acabado |
| Lámina lisa calibre 26 | m²; lámina como presentación | Ancho, largo, material y acabado |
| Disco de corte 7 pulgadas | Unidad | Marca, especificación y referencia de costo |
| Disco de corte 14 pulgadas | Unidad | Marca, especificación y referencia de costo |

La unidad metro propuesta para perfiles requiere conservar cantidad de barras y retazos, no solo un saldo agregado. Si se mantiene una unidad física distinta por compatibilidad, será necesaria una conversión de longitud explícita. Hoy Material solo tiene conversión específica de área; no debe usarse para convertir libras, cajas o metros de tubo.

Segunda prioridad: angulares, otros calibres y diámetros, anclajes, platinas, remaches, silicón, solvente rotulado Cener (nombre por confirmar), adhesivos, cable, cinta aislante, portalámparas, luminarias, transformadores, cemento, arena y piedrín. Compartidos entre áreas: conservar una ficha por material y registrar el área de uso en el componente/etapa, consolidando después el consumo total.

El anexo materiales-presupuestos-referencias-2026-11-12.md recoge 74 etiquetas originales con precios observados y referencias de celda. Son candidatos para normalizar, no 74 altas aprobadas. Para cada candidato: vincular ficha existente, crear variante diferenciada o dejar pendiente. La carga futura debe mostrar esa decisión, unidad, conversión, fuente y fecha antes de confirmar.

Los nuevos materiales empiezan con existencia cero salvo conteo físico confirmado. No crear entradas ficticias para fijar costo promedio. Mantener costo de referencia de compra, costo de cotización y precio del producto terminado separados. Los servicios de impresión, renta, viáticos y transporte no son materiales inventariables. Discos y brocas requieren distinguir stock de herramientas y costo de desgaste.

## Implementación por entregas, pendiente de aprobación

1. Normalizar materiales y presentaciones; revisar duplicados y datos incompletos. Preparar carga con trazabilidad por hoja y fila, sin sobrescribir precios verificados automáticamente.
2. Agregar gastos estructurados y el cálculo de precio/margen; parametrizar C$16/km, ida y vuelta, renta por trabajo y porcentajes. Congelar tarifas y reglas al emitir cada cotización.
3. Crear las primeras plantillas por componentes con vista previa de fórmulas y ajustes manuales auditados. Gerencia y personal autorizado administran plantillas; el cotizador solo selecciona y completa datos necesarios.
4. Trasladar a ODT materiales por área, cantidades estimadas y especificaciones, manteniendo los costos internos protegidos. Conservar estimación por componente aunque Inventario consolide movimientos por material.
5. Validar contra los siete ejemplos conciliados con la empresa, luego incorporar marquesinas compuestas, señalización por lotes y aprovechamiento de cortes más avanzado.

Aceptación: reproducir presupuestos históricos con sus parámetros históricos; no exigir coincidencia al aplicar las tarifas nuevas. Probar dos caras, laterales distintos, dos materiales con la misma geometría, cantidades parciales, formatos que no admiten el corte, viaje redondo y varios viajes, renta cero, hospedaje sin noches, descuentos, monedas, gastos sin duplicar y porcentajes sin solución válida. Comparar costo estimado con uso y horas reales para ajustar coeficientes; no modificar automáticamente una oferta emitida.

## Tesis y decisiones pendientes

La implementación futura afecta RF de cotización e Inventario, CF-01, CF-02 y CF-10, modelo y diccionario de datos, diagramas de cotización/conversión, permisos sobre tarifas/plantillas y pruebas de rentabilidad. Registrar cada entrega con código nuevo solo cuando se acuerde; esta propuesta no se marca Completado en el Word.

Pendiente de confirmar: base neta del precio final ante descuentos e impuestos al cliente; regla para elegir 5 % o 6 % local; unidades y equivalencias comerciales; tarifas vigentes de horas, viáticos y hospedaje; qué incluye la tarifa de impresión; identidad de filas ambiguas; alcance del segundo bloque de La Delicia. La referencia de C$1.500 se conserva como propuesta editable por trabajo.

## Aclaración del usuario sobre selección y categorías

El 12 de noviembre el usuario aclaró que cada hoja contiene el listado común de insumos de rotulación: el amarillo señala lo elegido para el trabajo y después se ingresan cantidades. La presencia de una fila no implica consumo ni una receta obligatoria del producto. Esta aclaración precisa la interpretación inicial del archivo. Al estudiar ejemplos para formar plantillas, contrastar selección visual y cantidades; un material marcado sin cantidad queda incompleto, no se presume consumido.

La propuesta del usuario es categoría comercial → subcategoría o tipo de producto → selección de materiales → cantidades y costos → renta y ganancia → revisión de disponibilidad. Las categorías compartidas en la captura son Diseño Gráfico, Impresión Digital, Rotulación, Impresión Láser/Burbuja/Offset, Corte Láser/Router, Sublimación, Producción Audiovisual y Acabado ID. Son categorías de servicios; no sustituyen ni duplican automáticamente las áreas productivas de TRACORE. Un producto de Rotulación puede requerir Taller, Impresión Digital y Acabado en su ODT.

Recomendación: tipos de producto configurables dentro de cada categoría. Por ejemplo, Rotulación puede ofrecer fascia plana, rótulo luminoso, rótulo con poste y mantenimiento. El tipo sugiere materiales pertinentes, sin imponer consumos ni impedir agregar otro material activo. El usuario marca materiales (equivalente al amarillo), el sistema propone las cantidades calculables y el usuario completa las estimadas. La cotización conserva los materiales realmente elegidos, no el listado completo de sugerencias. Una categoría puede contener servicios sin consumo de inventario, como Diseño Gráfico.

El usuario propone asignar renta por porcentaje según el monto del trabajo. La regla anterior de renta como monto asignado debe ampliarse en el diseño a dos modalidades excluyentes: monto fijo o porcentaje, con su base explícita. Si la renta porcentual se calcula sobre la misma venta final P que margen, imprevistos e impuestos internos, agregar su fracción a la fórmula: P = C / (1 - m - r - t - a), excluyendo ese cargo de C. La base concreta del porcentaje de renta y las bandas por monto aún no están confirmadas. No agregar simultáneamente C$1.500 y el porcentaje para el mismo concepto.

Disponibilidad propuesta: revisión informativa al cotizar, aviso antes de confirmar aprobación o convertir a ODT y revalidación al iniciar producción. Consolidar materiales del pedido y mostrar requerido, disponible y faltante con su unidad. Disponible = existencia utilizable menos reservas activas, si se implementan reservas. Cotizaciones en borrador no apartan ni descuentan material. Si varias órdenes aprobadas comprometen stock, una reserva transaccional y auditada evita prometer el mismo saldo a ambas. La reserva es distinta de la salida física; se libera o ajusta al cancelar o modificar la orden.

Los faltantes no deben impedir obtener aprobación comercial: presentar una opción de continuar con abastecimiento pendiente según permiso, manteniendo visible qué debe comprarse y su efecto en el plazo. Se puede iniciar con una lista de faltantes por ODT, sin construir todavía un módulo completo de compras. No reemplazar datos pendientes de verificar por una afirmación de falta física: diferenciar saldo confirmado insuficiente de existencia sin verificar. La suficiencia de láminas, rollos y perfiles requiere comprobar dimensiones aprovechables y retazos cuando estén disponibles, no únicamente el área o la longitud agregada.

Esta propuesta no cambia aún categorías, renta, reservas ni Inventario. Debe conservar acceso por autor, confidencialidad comercial frente a Producción, instantáneas de tarifas y auditoría de ajustes.

## Inicio de implementación COT-19

Completado el 12 de noviembre de 2026: configuración de categorías y tipos con materiales sugeridos y selección explícita en el editor. Documentado en los módulos 03 y 10, decisiones, modelo de datos, trazabilidad, alineación de tesis y Word. Las demás entregas de este plan permanecen pendientes; los siete presupuestos no se importaron como recetas automáticas ni se cargaron los candidatos de material.

## Continuación COT-20 y COT-21

El 2026-11-12 se implementaron la configuración guiada por producto y los gastos estructurados por partida, con tarifas sugeridas opcionales, moneda explícita e instantáneas. La edición masiva inicial COT-19 queda sustituida por COT-20. COT-21 cubre renta fija o porcentual, traslado de ida y vuelta, horas por persona, viáticos, hospedaje, imprevistos e impuestos internos sobre venta final. Para preservar esa base se exige descuento cero con cargos porcentuales; el margen es ajustable. Las tasas se concilian con las líneas redondeadas del motor.

Siguen pendientes: reparto de gastos y descuentos entre partidas, alertas de faltantes antes de aprobación/conversión, reservas, equivalencias y presentaciones, carga normalizada de los candidatos de material, geometrías por componente y validación comercial de los siete ejemplos. No se cargaron datos ficticios ni existencias en la base real.

## Continuación del 13 de noviembre — COT-22, COT-23 e INV-11

Se corrigen controles plegables y espacio de formularios. La distancia deja de capturarse por partida y queda en el mapa de Instalación, con coordenadas, ida y vuelta y tarifa de oferta editable. Se conservan las instantáneas antiguas. Se normalizan los materiales del Excel en 66 referencias: 63 altas y tres materiales existentes, sin stock ficticio; 16 tarifas siguen pendientes de verificar y no se inventan equivalencias. Detalle en carga-materiales-presupuestos-2026-11-13.md.

Quedan pendientes geometría por componente, presentaciones/equivalencias faltantes, reservas y avisos previos de faltantes. El reparto de gastos/descuentos entre partidas y la conciliación comercial de los siete ejemplos tampoco se declaran resueltos por esta carga.

## COT-24 Elección directa de producto — 2026-11-13

Se reemplaza marcar/aplicar sugerencias por carga inmediata de materiales al elegir el producto, con selección revisable y cantidades iniciales explícitas. Se conserva la selección en una instantánea y se habilitan servicios basados únicamente en horas o gastos fijos, sin costos manuales artificiales. La captura manual sigue disponible para trabajos libres. No se implementan aún geometrías por componente, reservas ni avisos nuevos de faltantes; las cantidades iniciales de materiales por unidad deben revisarse.
