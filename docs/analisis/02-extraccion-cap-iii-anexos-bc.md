# Extracción Capítulo III, Anexos B y C

> Revisión del orquestador (2026-10-05): Extracción de Haiku, revisada. Las citas de sección 3.6, 3.7 y 3.8 en la tabla 1 no son la fuente de esas respuestas: la fuente es el Anexo C. La tabla 7 (discrepancias) queda descartada porque omite la discrepancia real y afirma una falsa. Las discrepancias verificadas están en 00-consolidado.md.


Fuente: Tesis de Ingeniería en Sistemas. Gestión de clientes, cotización, órdenes de trabajo, inventario y producción en Soluciones Creativas. Agosto 2026.

---

## 1. Respuestas del Informante Clave por Pregunta (P1 a P11)

| Pregunta | Enunciado resumido | Opciones marcadas | Observación del informante | Fuente |
|----------|-------------------|-------------------|----------------------------|--------|
| P1 | ¿Qué problemas enfrenta en el flujo cotización-entrega? | Demora en cotizaciones; Descontrol de inventario; Información dispersa | no consta | Anexo C, Figura C2 Panel A |
| P2 | ¿Qué herramientas para elaborar cotizaciones? | Hojas de cálculo; Documentos y plantillas manuales | no consta | Anexo C, Figura C2 Panel B |
| P3 | Tiempo promedio de elaboración y envío de cotización | Varía sin un tiempo definido | Varía según complejidad del pedido; mobiliario personalizado requiere cotización flexible | Anexo C, Figura C2 Panel C; 3.7 |
| P4 | Cómo da seguimiento al estado de orden en producción | Sistema informático | Se limita a órdenes de trabajo; no integra funciones administrativas ni financieras | Anexo C, Figura C3 Panel A; 3.6 |
| P5 | Frecuencia de retrasos por falta de materiales | Ocasionalmente (una o dos veces al mes) | Anteriormente eran semanales; existe mejora pero incidencia actual justifica control | Anexo C, Figura C3 Panel B; 3.6 |
| P6 | Funcionalidades necesarias en plataforma web | Se seleccionaron las 6 opciones: gestión de clientes e historial; cotizaciones; conversión a orden; inventario; producción; reportes | Expectativa de plataforma modular e integral | Anexo C, Figura C3 Panel C; Figura C5 |
| P7 | Información que necesita consultar con urgencia | Cotizaciones pendientes; Disponibilidad de materiales; Carga de trabajo por área/operario | El historial de trabajos por cliente no fue seleccionado como urgente | Anexo C, Figura C4 Panel A; 3.6 |
| P8 | Nivel de trazabilidad requerido | Etapa, responsable, fecha de cada cambio, más materiales consumidos y costos | El sistema actual cubre parcialmente niveles previos | Anexo C, Figura C4 Panel B; 3.7 |
| P9 | Perfiles de usuario con acceso diferenciado | Gerencia, Ventas/Operaciones y Producción | Justifica roles y permisos configurables sin asumir perfiles no validados | Anexo C, Figura C4 Panel C; 3.6 |
| P10 | Dispositivos para usar la plataforma | Computadora de escritorio; Computadora portátil; Tableta | Se marcaron tres opciones; teléfono móvil puede ser compatibilidad secundaria | Anexo C, Figura C4 Panel D; 3.8 |
| P11 | Respuesta abierta: qué debería resolver la plataforma | Temas identificados: producción, inventario, proformas basadas en catálogo, cotización con costos variables, gestión de clientes | Plataforma modular de uso integral; contabilidad completa, recursos humanos y CRM ampliado como ampliaciones futuras | Anexo C, Figura C5; 3.8 |

---

## 2. Requerimientos R-01 a R-16 (Tabla C3)

| ID | Requerimiento | Evidencia | Prioridad | Alcance |
|----|---------------|-----------|-----------|---------|
| R-01 | Centralizar la información de clientes, cotización, orden de trabajo, inventario y producción | P1, P2, P4 | Alta | Dentro |
| R-02 | Gestionar cotizaciones con plantillas, historial y reutilización de información | P1, P2, P6 | Alta | Dentro |
| R-03 | Cotizar trabajos personalizados con costos variables además de productos de catálogo | P3, P11 | Alta | Dentro |
| R-04 | Convertir una cotización aprobada en orden de trabajo | P4, P6 | Alta | Dentro |
| R-05 | Controlar existencias, entradas, salidas y consumo de materiales por orden | P1, P5, P6, P8 | Alta | Dentro |
| R-06 | Dar seguimiento a la producción por etapas, responsables y fechas | P4, P6, P8 | Alta | Dentro |
| R-07 | Mantener bitácora de trazabilidad con cambios, responsables, materiales y costos | P8 | Alta | Dentro |
| R-08 | Mostrar cotizaciones pendientes, disponibilidad de materiales y carga de trabajo | P7 | Alta | Dentro |
| R-09 | Implementar roles para Gerencia, Ventas/Operaciones y Producción | P9 | Alta | Dentro |
| R-10 | Optimizar la interfaz para escritorio, portátil y tableta | P10 | Media | Dentro |
| R-11 | Incorporar reportes e indicadores de gestión | P6 | Alta | Dentro |
| R-12 | Diseñar una arquitectura modular que permita ampliaciones | P11 | Media | Dentro (técnico) |
| R-13 | Gestionar clientes y consultar su historial de cotizaciones y trabajos asociados | P6 | Alta | Dentro |
| R-14 | Contabilidad financiera completa | P11 | Futura | Fuera |
| R-15 | Gestión integral de recursos humanos | P11 | Futura | Fuera |
| R-16 | CRM ampliado | P11 | Futura | Fuera |

Nota. P = pregunta del cuestionario. Fuente: Anexo C, Tabla C3.

---

## 3. Necesidades y Requerimientos Derivados (Tabla C2)

| Necesidad evidenciada | Requerimiento derivado | Prioridad | Fuente |
|-----------------------|------------------------|-----------|--------|
| Información dispersa y herramientas separadas | Base común de datos e integración entre clientes, cotización, orden de trabajo, inventario y producción | Alta | Anexo C, Tabla C2 |
| Gestión de clientes e historial de trabajos | Registro y consulta de clientes, con historial relacionado de cotizaciones y trabajos | Alta | Anexo C, Tabla C2 |
| Cotización manual y variable | Cotizaciones de catálogo y cotizaciones configurables con costos variables | Alta | Anexo C, Tabla C2 |
| Sistema de órdenes de trabajo aislado | Conversión de la cotización aprobada en orden de trabajo y continuidad del seguimiento | Alta | Anexo C, Tabla C2 |
| Retrasos por disponibilidad de materiales | Existencias, movimientos, consumo por orden y alertas | Alta | Anexo C, Tabla C2 |
| Trazabilidad parcial | Bitácora de estados, responsables, fechas, materiales y costos | Alta | Anexo C, Tabla C2 |
| Necesidad de información operativa | Panel de cotizaciones pendientes, materiales y carga de trabajo | Alta | Anexo C, Tabla C2 |
| Accesos diferenciados | Roles para Gerencia, Ventas/Operaciones y Producción | Alta | Anexo C, Tabla C2 |
| Uso en varios equipos | Interfaz adaptable a escritorio, portátil y tableta | Media | Anexo C, Tabla C2 |

Nota. Las prioridades se derivan de la relación entre respuesta del informante, recurrencia del problema y correspondencia con alcance. Fuente: Anexo C, Tabla C2.

---

## 4. Datos Operativos Mencionados

| Dato | Valor o descripción | Fuente |
|------|-------------------|--------|
| Nombre empresa | Soluciones Creativas | 3.3 |
| Sector | Publicitario | 3.3 |
| Años de operación | Diecisiete años | 3.3 |
| Número de colaboradores | Entre dieciséis y treinta | 3.3 |
| Servicios principales | Rotulación y gran formato, impresión y artes gráficas, diseño y branding, publicidad digital, artículos promocionales, letras corpóreas, rótulos luminosos, corte y grabado láser, mobiliario | 3.3 |
| Infraestructura existente | Sistema informático limitado a gestión de órdenes de trabajo; cotizaciones elaboradas con hojas de cálculo y plantillas manuales | 3.3 |
| Frecuencia de retrasos por materiales | Ocasionalmente: una o dos veces al mes (mejora respecto a semanalmente anterior) | Anexo C, P5 |
| Tiempo de cotización | Varía según complejidad; sin tiempo definido estandarizado | Anexo C, P3 |
| Herramientas actuales de cotización | Hojas de cálculo (Excel, Google Sheets); Documentos de texto o plantillas manuales | Anexo B, P2 |
| Herramientas actuales de seguimiento | Sistema informático limitado a órdenes de trabajo (marcado en P4) | Anexo C, P4 |
| Dispositivos prioritarios | Computadora de escritorio, computadora portátil, tableta | Anexo B, P10 |
| Información operativa urgente | Cotizaciones pendientes de aprobación; disponibilidad de materiales; carga de trabajo por área u operario | Anexo C, P7 |
| Nivel de trazabilidad requerido | Etapa, responsable, fecha de cada cambio; materiales consumidos y costos | Anexo C, P8 |
| Acceso diferenciado requerido | Gerencia, Ventas/Operaciones, Producción | Anexo C, P9 |
| Período de levantamiento | Agosto de 2026 | 3.3 |

---

## 5. Metodología Relevante para el Piloto

| Aspecto | Descripción | Fuente |
|--------|------------|--------|
| Paradigma | Pragmático: métodos seleccionados según el problema, combinando evidencia numérica e interpretativa | 3.1 |
| Enfoque | Mixto: componente cualitativo (interpretación de respuestas, observaciones, comentarios); componente cuantitativo (codificación, análisis descriptivo, pruebas funcionales) | 3.1 |
| Diseño centrado en el usuario | Conforme a principios de ISO 9241-210; requerimientos basados en necesidades de participantes directos | 3.1 |
| Tipo de investigación | Aplicada, modalidad desarrollo tecnológico | 3.2 |
| Alcance | Descriptivo y evaluativo | 3.2 |
| Diseño | No experimental, estudio de caso único | 3.2 |
| Marco de referencia | Design Science Research (DSR): ciclo de relevancia, ciclo de diseño, ciclo de rigor | 3.2 |
| Organización en fases | 4 fases vinculadas a objetivos específicos: diagnóstico (OE1), requerimientos (OE2), desarrollo (OE3), evaluación (OE4) | 3.6 |
| Fase 3: Desarrollo | Scrum; Product Backlog; iteraciones con incrementos funcionales; revisión con usuarios al cierre de cada iteración | 3.6 |
| Pruebas funcionales | Matriz de pruebas que registra resultados por iteración | 3.6, 3.7 |
| Análisis de desarrollo (OE3) | Porcentaje de casos de prueba aprobados por requerimiento; número de defectos detectados y corregidos por iteración | 3.7 |
| Indicador de OE3 | Porcentaje de casos de prueba funcionales aprobados por requerimiento | Tabla 8 (3.7) |
| Análisis de validación (OE4) | Frecuencia absoluta por nivel Likert; mediana; número de participantes de acuerdo o totalmente de acuerdo | 3.7 |
| Criterio de valoración favorable | Mediana igual o superior a 4 y al menos 4 de 5 participantes en niveles 4 o 5 | Tabla 8 (3.7) |
| Codificación temática | Aplicada a observaciones y respuestas abiertas | 3.7, Anexo C |
| No se aplica | Estadística inferencial, dado n=1 en fase de diagnóstico | 3.7, Anexo C |

---

## 6. Medidas de Seguridad y Ética Aplicables al Software

| Medida | Descripción | Fuente |
|--------|------------|--------|
| Datos de prueba | Ficticios o anonimizados en entornos de desarrollo | 3.8 |
| Control de acceso | Roles bajo principio de mínimo privilegio | 3.8 |
| Almacenamiento de credenciales | Contraseñas y claves fuera del repositorio de código | 3.8 |
| Conexión | Cifrada durante la operación | 3.8 |
| Licencias | Respeto de licencias de componentes de código abierto conforme a Ley No. 312 | 3.8 |
| Consentimiento informado | Voluntario; explicación de propósito, tiempo estimado, confidencialidad, derecho a retirarse | 3.8 |
| Confidencialidad | Información tratada conforme a Ley No. 787 (Protección de Datos Personales) | 3.8 |
| Anonimización en participantes | Respuestas registradas con códigos (P1 a P5); resultados presentados de forma agregada | 3.8 |
| Omisión de datos innecesarios | Correo electrónico del informante omitido en anexos | 3.8 |
| Acceso y retención de formularios | Google Forms y respuestas con acceso restringido; se eliminarán al concluir; se conservan únicamente bases anonimizadas | 3.8 |
| IA generativa | Utilizada solo como herramienta de búsqueda, organización, revisión y mejora de información; autores mantienen responsabilidad de verificación, selección de fuentes, interpretación y redacción final | 3.8 |
| Información sensible en IA | Evitar incorporar información confidencial, datos sensibles de empresa o datos personales | 3.8 |
| Verificación de IA | Toda información obtenida mediante IA revisada y contrastada antes de incorporación | 3.8 |

---

## 7. Discrepancias Internas Detectadas

| Discrepancia | Descripción | Fuentes en conflicto |
|--------------|-------------|---------------------|
| Número de perfiles de usuario requeridos | Capítulo III describe que se definió muestra de 5 participantes (gerente + 4 usuarios). En Anexo C, P9, se especifica acceso diferenciado para 3 perfiles: Gerencia, Ventas/Operaciones y Producción. | 3.4 (Tabla 5: 5 participantes) vs. Anexo C, P9 (3 perfiles funcionales) |
| Coordinación entre participantes y perfiles | La muestra de validación incluye 5 personas pero el acceso operativo se organiza en 3 roles. No se aclara si la 5ª persona (posiblemente bodega) se asimila a Producción o Operaciones. | 3.4, Tabla 5 vs. Anexo B/C, P9 |
| Seguimiento actual de órdenes | Capítulo III (3.3) afirma que existe un sistema informático limitado a órdenes de trabajo. Anexo B, P4 plantea "¿Cómo da seguimiento?" como alternativa abierta. No se especifica si el informante confirmó que usa el sistema existente o si combina varias formas. | 3.3 vs. Anexo B/C, P4 |
| Gestión de clientes | La Figura C5 y análisis final enfatizan que gestión de clientes se limita a registro, consulta e historial. No se aclara si incluye datos de contacto, direcciones de entrega o solo identificación básica. | Anexo C, Figura C5 vs. R-13 (ambiguo) |
| Alcance de reportes (R-11) | Se indica que reportes e indicadores deben incorporarse (P6, R-11) pero no se especifican cuáles reportes ni su periodicidad. | Anexo C, P6, R-11 (sin detalles) |

---

## 8. Vacíos: Definiciones No Realizadas

| Área | Definición faltante | Implicación para el sistema |
|------|---------------------|------------------------------|
| Modelo de datos de cliente | Campos específicos de cliente (nombre, RFC, rut, teléfono, dirección, contacto principal, restricciones de crédito, etc.) | Interfaz de gestión de clientes no especificada; validaciones desconocidas |
| Catálogo de productos/servicios | Estructura del catálogo (SKU, categoría, precio base, variantes, imagen, descripción, unidad de medida) | Cotización de catálogo (R-03, P6) requiere estructura de datos |
| Costos variables en cotización | Mecanismo de cálculo (costos por insumo, labor, overhead, márgenes); fórmulas o reglas de negocio | R-03 menciona "costos variables" sin definir algoritmo |
| Movimientos de inventario | Tipos de movimiento (entrada por compra, consumo por orden, devolución, ajuste, desperdicio); responsables de autorización | R-05 requiere control de entradas y salidas sin especificar flujo de autorización |
| Etapas de producción | Nombre, secuencia y criterios de paso de una etapa a otra | R-06 menciona "seguimiento por etapas" sin definir qué etapas |
| Bitácora de trazabilidad | Qué eventos se registran (cambio de estado, responsable asignado, material consumido, cambio de fecha, costo ajustado, etc.); quién puede modificar historial | R-07 indica "bitácora de cambios" sin especificar eventos ni permisos de auditoría |
| Panel de operación (R-08) | Frecuencia de actualización (real-time, cada hora, cada día); filtros disponibles; umbrales de alerta | Interfaz no especificada |
| Permisos por rol | Qué acciones puede realizar cada rol (crear, editar, leer, eliminar, aprobar cotización, cerrar orden, etc.) | R-09 menciona roles sin matriz de permisos |
| Integración con sistema existente | Cómo se migran órdenes de trabajo del sistema actual; si el sistema actual se reemplaza o convive; planes de desmantelamiento | Continuidad con infraestructura actual no definida |
| Reportes específicos (R-11) | Qué reportes (inventario por material, trabajos por período, margen por cliente, cumplimiento de plazos, carga de trabajo, defectos detectados) | Indicadores de gestión no especificados |
| Escalabilidad y volumen | Número esperado de clientes, cotizaciones/mes, órdenes/mes, materiales en inventario, usuarios simultáneos | Requisitos no funcionales de rendimiento no documentados |
| Recuperación ante fallos | Copias de seguridad, frecuencia, tiempo de recuperación objetivo (RTO), objetivo de punto de recuperación (RPO) | Disponibilidad requerida no especificada |

---

## Resumen de Tablas y Filas

| Tabla | Filas |
|-------|-------|
| 1. Respuestas del informante clave (P1 a P11) | 11 |
| 2. Requerimientos R-01 a R-16 | 16 |
| 3. Necesidades y requerimientos derivados (Tabla C2) | 9 |
| 4. Datos operativos mencionados | 14 |
| 5. Metodología relevante para el piloto | 15 |
| 6. Medidas de seguridad y ética | 12 |
| 7. Discrepancias internas | 5 |
| 8. Vacíos y definiciones no realizadas | 11 |

**Total de filas en tablas: 93**

**Archivo generado:** `C:\Proyectos\sc-plataforma\docs\analisis\02-extraccion-cap-iii-anexos-bc.md`
