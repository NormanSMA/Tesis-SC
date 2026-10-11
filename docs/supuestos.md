# Supuestos de diseño

Lo que la tesis no define se registra aquí como supuesto.
Cada supuesto tiene una opción propuesta y una razón.
Estado histórico: aprobado por el usuario el 2026-10-05 (Fase 1).
Conserve margen sobre precio, fechas en date y costo unitario con cuatro decimales.
Sustituya los perfiles y ajustes anteriores por la matriz v9 de ADR-014.
Consulte [09-perfiles-v9.md](modulos/09-perfiles-v9.md) para los repartos por defecto revisables.
Alimenta el Capítulo IV y la matriz de pruebas del OE3.

| ID | Tema | Opción propuesta | Razón | Fuente del vacío | Jev |
|---|---|---|---|---|---|
| S-01 | Perfiles | Use seis perfiles: GERENCIA, ADMINISTRACION, OPERACIONES, ATENCION_CLIENTE, PRODUCCION y ADMIN. Permita varios perfiles por usuario. Una permisos efectivos. Reserve edición de matriz para ADMIN | Aplique Tabla 14 v9 y ADR-014 | Tesis v9; matriz de perfiles | Clasificación histórica: F09 documentado 0.94 |
| S-02 | Inventario y perfiles | Reserve entradas, consumos, devoluciones, ajustes y materiales para ADMINISTRACION. Permita consulta a ADMINISTRACION, OPERACIONES y GERENCIA. Combine perfiles mediante usuario_perfil | Aplique el reparto entre los seis perfiles v9 | Tabla 14 v9; ADR-014 | - |
| S-03 | Operarios | Use usuarios con perfil PRODUCCION. La siembra incluye cinco, según usuarios.json | P7 pide carga por operario | Anexo C P7 | F17 documentado 0.96 |
| S-04 | Moneda e impuesto | Córdoba. IVA 15 % configurable. La cotización es proforma | 1.7 excluye facturación electrónica | Vacío 2.6 | F04 supuesto 1.00 |
| S-05 | Valoración del material | Costo promedio ponderado por entrada | Se exige costo por orden, no el método | P8, Tabla 1 | F05 supuesto 0.68 |
| S-06 | Estados de cotización | BORRADOR, ENVIADA, APROBADA, RECHAZADA, VENCIDA, AJUSTE_SOLICITADO. Exija referencia al aprobar y motivo al solicitar ajuste. Cree una versión corregida | Aplique ADR-014 y los esquemas vigentes | P7, 2.6; tesis v9 | Clasificación histórica: F02 supuesto 0.96 |
| S-07 | Estados de orden | PENDIENTE, EN_PRODUCCION, LISTA, ENTREGADA, CERRADA, CANCELADA | 1.2 y P4 nombran pendiente, entrega y cierre | P4, 1.2 | F03 supuesto 0.94 |
| S-08 | Receta por producto | Lista opcional de materiales por producto de catálogo. Precarga el consumo estimado | Reduce captura al abrir la orden | R-02 | F06 supuesto 1.00 |
| S-09 | Existencias | Nunca negativas. El conflicto devuelve un error visible | Evita consumos imposibles | P5 | - |
| S-10 | Bitácora | Solo inserción. Un trigger bloquea UPDATE, DELETE y TRUNCATE | Reconstruir el trabajo exige historial confiable | P8, R-07 | F08 supuesto 0.57 |
| S-11 | Vigencia de cotización | 15 días, configurable | Práctica comercial común | Vacío | F15 supuesto 1.00 |
| S-12 | Plantillas de cotización | Duplicar una cotización existente y condiciones comerciales por defecto | R-02 pide plantillas y reutilización | R-02 | F13 documentado 0.44 |
| S-13 | Campos del cliente | Nombre o razón social, tipo, RUC opcional, contacto, teléfono, correo, dirección, notas | R-13 no define campos | Vacío 2.6 | F23 documentado 0.62 |
| S-14 | Unidades de medida | Unidad, metro, metro cuadrado, metro lineal, pliego, hora | Material y cotización necesitan unidad | Vacío 2.6 | - |
| S-15 | Margen, descuento y merma | Margen % por ítem personalizado, descuento global y merma % por línea de material (ver SD-14) | R-03 pide costos variables sin fórmula | CF-10 | F14 supuesto 0.66, F19 supuesto 1.00 |
| S-16 | Movimientos de inventario | ENTRADA, CONSUMO, AJUSTE, DEVOLUCION | R-05 nombra entradas, salidas y consumo | R-05 | F20 supuesto 0.95 |
| S-17 | Numeración | COT-AAAA-NNNN y OT-AAAA-NNNN | Referencia en pantalla y papel | Vacío | F12 supuesto 1.00 |
| S-18 | Reportes de R-11 | Cotizaciones por estado. Existencias y alertas. Carga por operario. Órdenes por etapa. Exportación CSV | R-11 no los lista | R-11 | F10 supuesto 0.92 |
| S-19 | Volumen | Cientos de órdenes al año. Hasta 30 usuarios | Empresa de 16 a 30 colaboradores | 3.3 | - |
| S-20 | Respaldo | Use volumen persistente y pg_dump. Inicie respaldo programado con docker compose up -d | Aplique RNF-06 v9 y conserve evidencia en el registro | 2.7; RNF-06 | - |
| S-21 | Migración del sistema actual | Fuera del piloto. Trabajo futuro | Sin acceso a su esquema | Vacío | - |
| S-22 | Etapas por servicio | Plantilla de etapas por categoría de producto | 2.6 dice que las etapas varían por servicio | 2.6 | F07 supuesto 0.79 |
| S-23 | Proforma imprimible | Vista de impresión y PDF de la cotización | 2.6 define la proforma como documento | 2.6 | F11 supuesto 0.99 |
| S-24 | Interfaz en móvil | Responsiva hasta 390 px. Prueba de esfuerzo | P10 y Anexo D ofrecen móvil | D4 | F18 documentado 0.91 |

Filas con Jev menor de 0.8: S-05, S-10, S-12, S-13, S-15 y S-22. Aprobadas con la recomendación del orquestador (S-05, S-10, S-15 supuesto; S-12 documentado; S-13 y S-22 parcial).

## Supuestos de datos (modelo de la Fase 1)

Nacen del diseño del modelo (docs/analisis/05-modelo-datos.md). Usan prefijo SD para no chocar con S.
Donde un SD detalla o corrige un S, manda el SD.

| ID | Supuesto | Relación con S |
|---|---|---|
| SD-12 | Cliente: nombre y tipo obligatorios. RUC opcional y único. Teléfono o correo obligatorio | Detalla S-13 |
| SD-13 | Área de producción como catálogo editable. Cada etapa pertenece a un área | Nuevo. Lo exige la carga por área (CF-06) |
| SD-14 | Ítem personalizado = suma de líneas (material con merma, mano de obra, terceros). Margen sobre precio de venta por ítem. Descuento como monto global | Corrige S-15 |
| SD-15 | Unidad de cobro: UNIDAD o M2. Lista cerrada de unidades de material. Texto libre en líneas de costo | Corrige S-14 |
| SD-16 | Etapa sin estado BLOQUEADA | Nuevo |
| SD-17 | Conserve las transiciones del modelo con la ampliación ENVIADA a AJUSTE_SOLICITADO de ADR-014 | Detalla S-06 y S-07 |
| SD-18 | Numeración anual por tipo, sin huecos, año según hora de Managua | Detalla S-17 |
| SD-19 | DEVOLUCION reingresa el sobrante de una orden. Salida sin orden es AJUSTE negativo con motivo | Detalla S-16 |
| SD-20 | Consumos, ajustes y devoluciones se valoran al costo promedio vigente | Detalla S-05 |
| SD-21 | Inicio de sesión por correo. Bloqueo temporal tras intentos fallidos | Nuevo |
| SD-22 | Fechas comprometidas y planificadas como fecha de calendario (date) | Nuevo. Precisa la regla de timestamptz |
| SD-23 | Cada orden tiene una categoría principal que define sus etapas. Se agregan etapas a mano | Detalla S-22 |
| SD-24 | Reemplazada donde contradiga ADR-014. Use la matriz de docs/modulos/09-perfiles-v9.md y src/core/permisos.ts | Actualiza S-01 y S-02 |
| SD-25 | Conserve congelada la cotización enviada. Cree una versión corregida desde AJUSTE_SOLICITADO con número de versión incrementado | Detalla S-12; ADR-014 |

Desviaciones a aprobar (P-04): fechas de calendario en date (SD-22) y costo unitario con cuatro decimales.
| SD-26 | Los documentos asociados muestran los datos actuales del cliente, sin copia histórica | Nuevo. Decisión ADR-011. Jev: supuesto 0.95 |
