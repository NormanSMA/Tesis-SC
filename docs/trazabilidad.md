# Trazabilidad entre la tesis y el piloto

Actualizado: 2026-10-05. Fase 1 (análisis). Ninguna fila está implementada.
Estados: implementado, parcial, supuesto, pendiente.
Captura: ruta en docs/capturas. Prueba: archivo y caso.

## Criterios de aceptación (Anexo D)

| CF / requisito | Fuente | Módulo | Estado | Prueba | Captura |
|---|---|---|---|---|---|
| CF-01 | Anexo D A1; R-04 | Órdenes | pendiente | por definir | - |
| CF-02 | Anexo D A2; R-06 | Órdenes, Producción | pendiente | por definir | - |
| CF-03 | Anexo D A3; R-05 | Inventario | pendiente | por definir | - |
| CF-04 | Anexo D A4; R-05 | Inventario | pendiente | por definir | - |
| CF-05 | Anexo D A5; R-07 | Trazabilidad | pendiente | por definir | - |
| CF-06 | Anexo D A6; R-08, R-11 | Panel | pendiente | por definir | - |
| CF-07 | Anexo D A7; R-09 | Acceso | pendiente | por definir | - |
| CF-08 | Anexo D A8; R-10 | Layout | pendiente | por definir | - |
| CF-09 | Anexo D A9; R-01 | Transversal | pendiente | por definir | - |
| CF-10 | Anexo D A10; R-03 | Cotizaciones | pendiente | por definir | - |
| CF-11 | Anexo D A11; R-13 | Clientes | pendiente | por definir | - |

## Requerimientos R-01 a R-13 (Tabla C3)

| CF / requisito | Fuente | Módulo | Estado | Prueba | Captura |
|---|---|---|---|---|---|
| R-01 Centralizar la información | Anexo C Tabla C3 | Transversal | pendiente | por definir | - |
| R-02 Cotizaciones con plantillas, historial y reutilización | Anexo C Tabla C3 | Cotizaciones | pendiente | por definir | - |
| R-03 Costos variables | Anexo C Tabla C3 | Cotizaciones | pendiente | por definir | - |
| R-04 Cotización a orden | Anexo C Tabla C3 | Órdenes | pendiente | por definir | - |
| R-05 Existencias y consumo por orden | Anexo C Tabla C3 | Inventario | pendiente | por definir | - |
| R-06 Producción por etapas | Anexo C Tabla C3 | Producción | pendiente | por definir | - |
| R-07 Bitácora de trazabilidad | Anexo C Tabla C3 | Trazabilidad | pendiente | por definir | - |
| R-08 Cotizaciones pendientes, materiales, carga | Anexo C Tabla C3 | Panel | pendiente | por definir | - |
| R-09 Roles | Anexo C Tabla C3 | Acceso | pendiente | por definir | - |
| R-10 Escritorio, portátil y tableta | Anexo C Tabla C3 | Layout | pendiente | por definir | - |
| R-11 Reportes e indicadores | Anexo C Tabla C3 | Panel | pendiente | por definir | - |
| R-12 Arquitectura modular | Anexo C Tabla C3 | Arquitectura | pendiente | por definir | - |
| R-13 Gestión de clientes | Anexo C Tabla C3 | Clientes | pendiente | por definir | - |

## Requisitos no funcionales

| CF / requisito | Fuente | Módulo | Estado | Prueba | Captura |
|---|---|---|---|---|---|
| Accesibilidad WCAG 2.2 | 2.4.1, 2.7 | Layout | pendiente | axe en Playwright | - |
| API REST con recursos de negocio | 2.4.2, 2.5.3 | Todos | pendiente | Pruebas de API | - |
| Reglas, permisos y trazabilidad en servidor | 2.4.4, 2.7 | Todos | pendiente | Pruebas de API por perfil | - |
| Integridad referencial y transacciones | 2.4.3, 2.7 | Datos | pendiente | Pruebas contra Postgres | - |
| Calidad de datos ISO/IEC 25012 | 2.3.3, 2.4.3 | Datos | pendiente | Validación zod y restricciones | - |
| Despliegue reproducible | 2.7 | Despliegue | pendiente | docker compose up en limpio | - |
| Calidad ISO/IEC 25010 | 2.5.4, 2.7 | Todos | pendiente | calidad-iso25010.md | - |
| Pruebas de rendimiento | 2.5.4 | API | pendiente | Prueba de carga corta | - |
| Datos ficticios y secretos fuera del repositorio | 3.8 | Despliegue | pendiente | Revisión de .env.example | - |

## Supuestos de diseño (docs/supuestos.md)

| CF / requisito | Fuente | Módulo | Estado | Prueba | Captura |
|---|---|---|---|---|---|
| S-01 Perfiles | Vacío de la tesis: D1 | Acceso | supuesto | por definir | - |
| S-02 Inventario y perfiles | Vacío de la tesis: D2 | Inventario, Acceso | supuesto | por definir | - |
| S-03 Operarios | Vacío de la tesis: Anexo C P7 | Producción | supuesto | por definir | - |
| S-04 Moneda e impuesto | Vacío de la tesis: Vacío 2.6 | Cotizaciones | supuesto | por definir | - |
| S-05 Valoración del material | Vacío de la tesis: P8, Tabla 1 | Inventario | supuesto | por definir | - |
| S-06 Estados de cotización | Vacío de la tesis: P7, 2.6 | Cotizaciones | supuesto | por definir | - |
| S-07 Estados de orden | Vacío de la tesis: P4, 1.2 | Órdenes | supuesto | por definir | - |
| S-08 Receta por producto | Vacío de la tesis: R-02 | Cotizaciones, Órdenes | supuesto | por definir | - |
| S-09 Existencias | Vacío de la tesis: P5 | Inventario | supuesto | por definir | - |
| S-10 Bitácora | Vacío de la tesis: P8, R-07 | Trazabilidad | supuesto | por definir | - |
| S-11 Vigencia de cotización | Vacío de la tesis: Vacío | Cotizaciones | supuesto | por definir | - |
| S-12 Plantillas de cotización | Vacío de la tesis: R-02 | Cotizaciones | supuesto | por definir | - |
| S-13 Campos del cliente | Vacío de la tesis: Vacío 2.6 | Clientes | supuesto | por definir | - |
| S-14 Unidades de medida | Vacío de la tesis: Vacío 2.6 | Inventario, Cotizaciones | supuesto | por definir | - |
| S-15 Margen, descuento y merma | Vacío de la tesis: CF-10 | Cotizaciones | supuesto | por definir | - |
| S-16 Movimientos de inventario | Vacío de la tesis: R-05 | Inventario | supuesto | por definir | - |
| S-17 Numeración | Vacío de la tesis: Vacío | Cotizaciones, Órdenes | supuesto | por definir | - |
| S-18 Reportes de R-11 | Vacío de la tesis: R-11 | Panel | supuesto | por definir | - |
| S-19 Volumen | Vacío de la tesis: 3.3 | Despliegue | supuesto | por definir | - |
| S-20 Respaldo | Vacío de la tesis: 2.7 | Despliegue | supuesto | por definir | - |
| S-21 Migración del sistema actual | Vacío de la tesis: Vacío | Fuera del piloto | supuesto | por definir | - |
| S-22 Etapas por servicio | Vacío de la tesis: 2.6 | Producción | supuesto | por definir | - |
| S-23 Proforma imprimible | Vacío de la tesis: 2.6 | Cotizaciones | supuesto | por definir | - |
| S-24 Interfaz en móvil | Vacío de la tesis: D4 | Layout | supuesto | por definir | - |
