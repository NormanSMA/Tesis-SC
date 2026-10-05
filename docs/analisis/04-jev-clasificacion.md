# Clasificación de funcionalidades con Jev

Fecha: 2026-10-05. Modelo jev-1.13.0. Pregunta: la tesis documenta la funcionalidad o es un supuesto de diseño.
Regla: confianza 0.8 o mayor actúa. Menor de 0.8 se consulta al usuario.

| ID | Funcionalidad | Jev | Confianza | Acción |
|---|---|---|---|---|
| F01 | Alertas de stock minimo de materiales | documentado | 0.96 | Aplicar |
| F02 | Estados de cotizacion: borrador, enviada, aprobada, rechazada, vencida | supuesto | 0.96 | Aplicar |
| F03 | Estados de orden: pendiente, en produccion, lista, entregada, cerrada, cancelada | supuesto | 0.94 | Aplicar |
| F04 | IVA 15 por ciento configurable en la cotizacion | supuesto | 1.00 | Aplicar |
| F05 | Costo promedio ponderado de materiales | supuesto | 0.68 | Consultar. Recomendación del orquestador: supuesto |
| F06 | Receta de materiales estandar por producto de catalogo | supuesto | 1.00 | Aplicar |
| F07 | Plantillas de etapas de produccion por categoria de servicio | supuesto | 0.79 | Consultar. Recomendación del orquestador: parcial |
| F08 | Bitacora de solo insercion protegida por trigger de base de datos | supuesto | 0.57 | Consultar. Recomendación del orquestador: supuesto |
| F09 | Matriz de permisos editable por administracion del sistema | documentado | 0.94 | Aplicar |
| F10 | Exportacion de reportes a CSV | supuesto | 0.92 | Aplicar |
| F11 | Proforma en PDF imprimible | supuesto | 0.99 | Aplicar |
| F12 | Numeracion correlativa de cotizaciones y ordenes | supuesto | 1.00 | Aplicar |
| F13 | Duplicar una cotizacion anterior para reutilizar datos | documentado | 0.44 | Consultar. Recomendación del orquestador: documentado |
| F14 | Margen porcentual y descuento en la cotizacion | supuesto | 0.66 | Consultar. Recomendación del orquestador: supuesto |
| F15 | Vigencia de cotizacion con vencimiento | supuesto | 1.00 | Aplicar |
| F16 | Perfil administracion del sistema con gestion de usuarios | documentado | 0.99 | Aplicar |
| F17 | Panel con carga de trabajo por operario y por area | documentado | 0.96 | Aplicar |
| F18 | Interfaz utilizable en telefono movil como compatibilidad secundaria | documentado | 0.91 | Aplicar |
| F19 | Merma porcentual por material en el costeo | supuesto | 1.00 | Aplicar |
| F20 | Tipos de movimiento de inventario: entrada, consumo, ajuste, devolucion | supuesto | 0.95 | Aplicar |
| F21 | Autenticacion con usuario y contrasena y sesiones | documentado | 0.99 | Aplicar |
| F22 | Carga de trabajo y fechas de entrega comprometidas por orden | documentado | 0.94 | Aplicar |
| F23 | Registro de cliente con RUC, telefono, correo y direccion | documentado | 0.62 | Consultar. Recomendación del orquestador: parcial |
| F24 | Prueba de rendimiento basica de la API | documentado | 0.80 | Aplicar |
| F25 | Historial de precios de materiales | supuesto | 1.00 | Aplicar |

Las filas marcadas Consultar pasan a la revisión de la Fase 1. La recomendación del orquestador sale de leer la fuente: F07 y F23 son parciales porque la tesis documenta la necesidad pero no la forma.
