# Análisis consolidado de la Fase 1

Fecha: 2026-10-05. Fuente autoritativa: PCE_Soluciones_Creativas_Cap_I-III_APA7_v6.docx.
Extracciones de apoyo: archivos 01, 02 y 03 de esta carpeta (revisados).
Clasificación con Jev: archivo 04.

## 1. Actores

| Actor | Perfil en el sistema | Necesidad principal | Fuente |
|---|---|---|---|
| Gerencia | GERENCIA | Información consolidada para supervisar | 1.1, 1.6 |
| Atención al cliente y ventas | VENTAS | Cotizar y mantener continuidad hasta la ejecución | 1.1, 1.6 |
| Producción | PRODUCCION | Disponibilidad de materiales y seguimiento por etapas | 1.1, 1.6 |
| Administración del sistema | ADMIN | Usuarios, perfiles y permisos | 1.7 |
| Cliente (externo) | Sin acceso al sistema | Respuestas precisas sobre su pedido | 1.6 |

El perfil ADMIN aparece en 1.7 y no en el Anexo C. Ver discrepancia D1.

## 2. Flujo de trabajo integrado

| Paso | Actividad | Módulo | Estado resultante | Criterio |
|---|---|---|---|---|
| 1 | Solicitud del cliente | Clientes | - | CF-11 |
| 2 | Registro o consulta del cliente | Clientes | - | CF-11 |
| 3 | Elaboración de la cotización (catálogo o personalizada) | Cotizaciones | BORRADOR | CF-10 |
| 4 | Envío al cliente | Cotizaciones | ENVIADA | CF-06 |
| 5 | Aprobación o rechazo | Cotizaciones | APROBADA, RECHAZADA o VENCIDA | CF-06 |
| 6 | Conversión en orden de trabajo | Órdenes | PENDIENTE | CF-01 |
| 7 | Asignación de responsable y fechas | Órdenes | PENDIENTE | CF-02 |
| 8 | Asignación y consumo de materiales | Inventario | - | CF-03, CF-04 |
| 9 | Ejecución por etapas | Producción | EN_PRODUCCION, LISTA | CF-02 |
| 10 | Entrega | Órdenes | ENTREGADA | CF-02 |
| 11 | Cierre y consulta de la trazabilidad completa | Órdenes, Trazabilidad | CERRADA | CF-05, CF-09 |

Los nombres de estado son el supuesto S-06 y S-07. La tesis no los define.

## 3. Requerimientos R-01 a R-13 y su módulo

| R | Requerimiento (resumen) | Módulo | CF | Estado de la tesis |
|---|---|---|---|---|
| R-01 | Centralizar la información de los cinco procesos | Transversal | CF-09 | Documentado |
| R-02 | Cotizaciones con plantillas, historial y reutilización | Cotizaciones | CF-10 | Documentado. Forma: supuesto S-12 |
| R-03 | Cotizar trabajos personalizados con costos variables | Cotizaciones | CF-10 | Documentado |
| R-04 | Convertir cotización aprobada en orden | Órdenes | CF-01 | Documentado |
| R-05 | Existencias, entradas, salidas y consumo por orden | Inventario | CF-03, CF-04 | Documentado |
| R-06 | Producción por etapas, responsables y fechas | Producción | CF-02 | Documentado |
| R-07 | Bitácora con cambios, responsables, materiales y costos | Trazabilidad | CF-05 | Documentado |
| R-08 | Cotizaciones pendientes, materiales y carga de trabajo | Panel | CF-06 | Documentado |
| R-09 | Roles de Gerencia, Ventas/Operaciones y Producción | Acceso | CF-07 | Documentado. Cuatro perfiles: D1 |
| R-10 | Interfaz para escritorio, portátil y tableta | Layout | CF-08 | Documentado |
| R-11 | Reportes e indicadores de gestión | Panel y reportes | CF-06 | Documentado. Reportes concretos: supuesto |
| R-12 | Arquitectura modular para ampliaciones | Arquitectura | - | Documentado (técnico) |
| R-13 | Gestionar clientes y su historial | Clientes | CF-11 | Documentado |
| R-14 a R-16 | Contabilidad, RR. HH., CRM ampliado | No se construyen | - | Fuera de alcance |

## 4. Discrepancias verificadas contra la fuente

| ID | Discrepancia | Fuentes | Resolución |
|---|---|---|---|
| D1 | Cuatro perfiles en 1.7. Tres validados en P9, R-09 y Tabla C2. La opción "bodega" no se marcó | 1.7 frente a Anexo C | Cuatro perfiles. ADMIN no es de negocio. S-01 |
| D2 | La muestra de validación incluye un usuario de "inventario de materiales". P9 no validó perfil de bodega | Anexo D II frente a Anexo C P9 | Ese usuario recibe el perfil PRODUCCION. S-02 |
| D3 | El xlsx usa una redacción anterior: título sin "gestión de clientes", pregunta general distinta, OE-3 y OE-4 abreviados. No trae productos ni indicadores | xlsx frente a 1.3, 1.4 y Tabla 2 | El docx manda. Se sugiere actualizar el xlsx |
| D4 | 1.7 excluye apps móviles nativas. P10 acepta móvil como compatibilidad secundaria. El cuestionario del Anexo D ofrece "teléfono móvil" como dispositivo | 1.7, Anexo C P10, Anexo D II | El diseño responde hasta 390 px. Se prueba como esfuerzo, no como criterio de aceptación |
| D5 | R-05 no nombra alertas. Tabla C2 sí | Tabla C3 frente a Tabla C2 | Alertas de stock mínimo dentro de alcance |
| D6 | 1.7 excluye también inteligencia artificial avanzada y optimización industrial. El prompt de la sesión no lo lista | 1.7 | Se respeta 1.7 |

## 5. Vacíos y decisión propuesta

| Vacío | Por qué importa | Decisión propuesta | ID |
|---|---|---|---|
| Estados de cotización y orden | Transiciones y tableros | Listas del plan | S-06, S-07 |
| Campos del cliente | Formulario y validación | Nombre, tipo, RUC opcional, contacto, teléfono, correo, dirección | S-13 |
| Etapas de producción por servicio | Seguimiento por etapa | Plantilla por categoría, editable en el seed | S-22 |
| Moneda e impuesto | Costeo | NIO e IVA 15 % configurable | S-04 |
| Unidades de medida | Material y cotización | Unidad, metro, m2, metro lineal, pliego, hora | S-14 |
| Fórmula de costo y margen | CF-10 | Suma de líneas más merma, margen % y descuento | S-05, S-15 |
| Permisos por perfil | CF-07 | Matriz recurso:acción en base de datos | S-01 |
| Tipos de movimiento de inventario | CF-04 | Entrada, consumo, ajuste, devolución | S-16 |
| Numeración de documentos | Referencia en pantalla y papel | COT-AAAA-NNNN y OT-AAAA-NNNN | S-17 |
| Reportes concretos (R-11) | Panel | Cuatro reportes: cotizaciones por estado, existencias y alertas, carga por operario, órdenes por etapa | S-18 |
| Volumen esperado | Rendimiento | Una pyme de 16 a 30 personas. Se asumen cientos de órdenes al año | S-19 |
| Respaldo y recuperación | Despliegue | Volumen de Docker y script de respaldo con pg_dump documentado | S-20 |
| Migración desde el sistema de órdenes actual | Convivencia | Fuera del piloto. Se documenta como trabajo futuro | S-21 |

## 6. Requisitos no funcionales con fuente

| Requisito | Fuente | Verificación en el piloto |
|---|---|---|
| Interfaz adaptable a escritorio, portátil y tableta | 1.7, 2.7, P10 | Playwright en cuatro tamaños |
| Accesibilidad WCAG 2.2 | 2.4.1, 2.7 | axe sin hallazgos críticos ni serios |
| API REST con recursos de negocio | 2.4.2, 2.5.3 | Rutas bajo /api/v1 con pruebas |
| Reglas, permisos y trazabilidad en el servidor | 2.4.4, 2.7 | Pruebas de API con perfiles |
| Autenticación, roles, permisos, registro de operaciones, validación en servidor | 2.4.4 | Pruebas de seguridad básicas |
| Integridad referencial y transacciones | 2.4.3, 2.7 | Restricciones de base de datos y pruebas |
| Calidad de datos: exactitud, completitud, consistencia, accesibilidad | 2.3.3, 2.4.3 (ISO/IEC 25012) | Validación con zod y restricciones |
| Separación presentación, reglas y datos | 2.4.2 (ISO/IEC/IEEE 42010) | Estructura de carpetas y pruebas del núcleo |
| Pruebas funcionales, de integración, de seguridad, de rendimiento y de usabilidad | 2.5.4 | Matriz de pruebas. Se añade una prueba de carga corta |
| Calidad de producto ISO/IEC 25010 | 2.5.4, 2.7 | docs/calidad-iso25010.md |
| Despliegue reproducible, respaldo, conexión segura | 2.7 | Docker Compose, script de respaldo, aviso de TLS en producción |
| Datos de prueba ficticios, mínimo privilegio, secretos fuera del repositorio, conexión cifrada, licencias | 3.8 | Seed ficticio, .env.example, auditoría de licencias |

## 7. Datos de contexto útiles para el seed

- Servicios de la empresa: rotulación y gran formato, impresión y artes gráficas, diseño y branding, publicidad digital, artículos promocionales, letras corpóreas y rótulos luminosos, corte y grabado láser, mobiliario.
- Retrasos por falta de material: una o dos veces al mes. El seed incluye materiales bajo el mínimo.
- Cotización personalizada típica: mobiliario. El seed incluye al menos una.
- Plantilla de la empresa: 16 a 30 personas. El seed crea cuatro operarios.
- Tutor: Dr. Carlos Alexander Mendoza Jacomino. Autores: Norman Smith Martínez Acevedo (21012247) y Jorge Alí Rodríguez (21012508).
