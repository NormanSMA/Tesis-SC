# Requisitos de la tesis v9 (extracción verificada)

Fuente: `C:\claude-mem\raw\tesis-sc\tesis-v9.md`, líneas indicadas. Verificadas contra el texto el 2026-10-10 (RF-01, RF-10, RNF-01, RNF-08, RB-01, RB-05, RB-10).

## Requisitos funcionales y no funcionales
| Código | Atributo | Medida o criterio | Línea |
|---|---|---|---|
| RF-01 | Integridad del expediente | 100 % de cotizaciones y órdenes del cliente en su expediente; sin expedientes duplicados | 344 |
| RF-02 | Exactitud de cotización | 100 % de conceptos aparecen; total = suma de importes | 345 |
| RF-03 | Conversión cotización-orden | 100 % de aprobadas generan una sola orden; no aprobadas no generan | 346 |
| RF-04 | Continuidad de información | Cliente, id de cotización y conceptos coinciden en 100 % de órdenes | 347 |
| RF-05 | Exactitud de existencias | Existencia final = inicial + entradas - salidas, en 100 % de pruebas | 348 |
| RF-06 | Control de consumo | 100 % de consumos con material, cantidad y orden; ninguna existencia negativa | 349 |
| RF-07 | Seguimiento de producción | 100 % de cambios válidos actualiza etapa, responsable y fecha-hora | 350 |
| RF-08 | Trazabilidad | 100 % de eventos consultables en orden cronológico, sin sobrescribir | 351 |
| RF-09 | Información operativa | Datos del panel = 100 % de registros activos de la prueba | 352 |
| RF-10 | Control de acceso funcional | 100 % de operaciones permitidas se ejecuta; 100 % de no permitidas se rechaza | 353 |
| RNF-01 | Tiempo de respuesta | Al menos 95 % de operaciones en 2 s o menos, con 20 sesiones concurrentes | 359 |
| RNF-02 | Autenticación | 100 % de funciones protegidas rechaza solicitudes sin sesión válida | 360 |
| RNF-03 | Autorización | 100 % de casos no autorizados rechazado sin modificar información | 361 |
| RNF-04 | Confidencialidad en tránsito | 100 % de conexiones HTTPS con TLS 1.2 o superior | 362 |
| RNF-05 | Integridad transaccional | Cero órdenes duplicadas, cero registros huérfanos, cero existencias negativas | 363 |
| RNF-06 | Respaldo | Al menos un respaldo exitoso cada 24 horas | 364 |
| RNF-07 | Recuperabilidad | Restauración sin errores de integridad en máximo 4 horas | 365 |
| RNF-08 | Adaptabilidad | Flujos críticos en 768, 1024, 1366 y 1920 px sin superposición ni desplazamiento horizontal | 366 |

## Reglas de negocio
| Código | Regla | Criterio | Línea |
|---|---|---|---|
| RB-01 | Cliente único | No se crean dos clientes con el mismo identificador interno | 374 |
| RB-02 | Cotización con cliente | 100 % de cotizaciones con referencia válida a cliente | 375 |
| RB-03 | Total de cotización | Total = suma de importes de conceptos, en 100 % de casos | 376 |
| RB-04 | Orden solo desde aprobada | Rechaza 100 % de intentos desde estados distintos de aprobado | 377 |
| RB-05 | Orden activa única | Repetir la operación no genera segunda orden activa | 378 |
| RB-06 | Consumo transaccional | Existencia = saldo calculado tras cada consumo; nunca negativa | 379 |
| RB-07 | Consumo ligado a orden | 100 % de consumos con referencia válida a orden | 380 |
| RB-08 | Etapa con responsable y fecha-hora | 100 % de cambios contiene los tres datos en el historial | 381 |
| RB-09 | Historial no sustituible | Un nuevo evento no modifica eventos previos | 382 |
| RB-10 | Operaciones según rol | 100 % de pruebas de autorización coincide con la matriz rol-permiso | 383 |

## Mapeo de códigos antiguos (trazabilidad v6) a v9
| Antiguo | v9 | Nota |
|---|---|---|
| CF-01 | RF-03, RF-04 | Conversión y herencia |
| CF-02 | RF-07, RB-08 | Etapas; asignar, omitir, retrabajo y tablero sin equivalente |
| CF-03 | RF-06, RB-07 | Estimado contra consumido y ocultar costos sin equivalente |
| CF-04 | RF-05, RB-06, RNF-05 | Costo promedio, alertas, conciliación y ajuste sin equivalente |
| CF-05 | RF-08, RB-09 | Costo real y lista blanca sin dinero sin equivalente |
| CF-06 | RF-09 | Reportes JSON y CSV sin equivalente |
| CF-07 | RF-10, RB-10, RNF-02, RNF-03 | Equivalente temático |
| CF-08 | RNF-08 | Anchos distintos; WCAG 2.2 sin equivalente |
| CF-09 | Sin equivalente directo | Transversal; cerca de RF-04 y RF-08 |
| CF-10 | RF-02, RB-03 | Materiales, mano de obra, terceros y envío sin equivalente |
| CF-11 | RF-01, RB-01 | Enlaces de la ficha sin código propio |
| R-01 | Sin equivalente directo | Centralizar información; cerca de RF-04 |
| R-02 | Sin equivalente | Plantillas, historial y reutilización de cotizaciones |
| R-03 | Sin equivalente directo | Costos variables; cerca de RF-02 |
| R-04 | RF-03, RF-04 | Equivalente directo |
| R-05 | RF-05, RF-06, RB-06, RB-07 | Equivalente temático |
| R-06 | RF-07, RB-08 | Etapas por servicio sin equivalente |
| R-07 | RF-08, RB-09 | Equivalente temático |
| R-08 | RF-09 | Equivalente temático |
| R-09 | RF-10, RB-10 | Equivalente temático |
| R-10 | RNF-08 | Anchos distintos |
| R-11 | RF-09 | Reportes CSV sin equivalente |
| R-12 | Sin equivalente | Arquitectura modular no aparece en v9 |
| R-13 | RF-01, RB-01 | Enlaces de la ficha sin código propio |

Códigos v9 sin equivalente antiguo: RNF-04, RNF-06, RNF-07, RNF-01 (solo fila temática), RB-02.
