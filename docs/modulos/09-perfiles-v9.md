# Módulo 9: perfiles y permisos según la tesis v9

Fuente: tesis v9, Tabla 14 (4.5) y ADR-014. Esta matriz reemplaza ADR-006 y la sección (c) del modelo de datos (SD-24).

## Perfiles
| Código | Nombre | Función |
|---|---|---|
| GERENCIA | Gerencia | Consulta. No ejecuta operaciones de negocio. |
| ADMINISTRACION | Administración | Registra consumos y ajustes. Consulta inventario. Asigna responsables. Actualiza etapas. |
| OPERACIONES | Operaciones | Genera, asigna, inicia, cierra y cancela órdenes. Registra la aprobación comercial. |
| ATENCION_CLIENTE | Atención al cliente | Atiende clientes, cotiza, registra la aprobación, entrega y cierra con Operaciones. |
| PRODUCCION | Producción | Actualiza etapas de producción. |
| ADMIN | Administración técnica | Solo usuarios, permisos y configuración. No hereda operaciones de negocio. |

VENTAS pasa a ATENCION_CLIENTE (mismo UUID). Un usuario puede tener varios perfiles. Los permisos efectivos son la unión.

## Tabla 14 de la tesis frente a permisos
| Operación v9 | Perfiles v9 | Permiso |
|---|---|---|
| Registrar consumo de materiales | Administración | inventario:consumir |
| Consultar inventario | Administración, Operaciones, Gerencia | inventario:ver |
| Asignar responsables | Operaciones, Administración | produccion:planificar, orden:gestionar |
| Actualizar etapas | Producción, Administración | produccion:ejecutar |
| Registrar aprobación de cotización | Operaciones, Atención al cliente | cotizacion:responder |

## Matriz completa (X = concedido)
| Permiso | GER | ADM | OPE | ATC | PRO | ADMIN |
|---|---|---|---|---|---|---|
| cliente:ver | X | | X | X | | |
| cliente:gestionar | | | | X | | |
| catalogo:ver | X | X | X | X | X | |
| catalogo:gestionar | | | X | | | |
| cotizacion:ver | X | X | X | X | | |
| cotizacion:gestionar | | | | X | | |
| cotizacion:enviar | | | | X | | |
| cotizacion:responder | | | X | X | | |
| orden:ver | X | X | X | X | X | |
| orden:crear | | | X | | | |
| orden:gestionar | | X | X | | | |
| orden:avanzar | | X | X | | X | |
| orden:entregar | | | X | X | | |
| orden:cerrar | | | X | X | | |
| orden:cancelar | | | X | | | |
| produccion:ver | X | X | X | X | X | |
| produccion:planificar | | X | X | | | |
| produccion:ejecutar | | X | | | X | |
| inventario:ver | X | X | X | | | |
| inventario:entrada | | X | | | | |
| inventario:consumir | | X | | | | |
| inventario:ajustar | | X | | | | |
| material:gestionar | | X | | | | |
| bitacora:ver | X | | | | | X |
| panel:ver | X | X | X | X | X | |
| reporte:ver | X | | | | | |
| reporte:exportar | X | | | | | |
| usuario:gestionar | | | | | | X |
| permiso:gestionar | | | | | | X |
| configuracion:gestionar | | | | | | X |

## Decisiones por defecto (Norman no respondió; revisables)
1. Gerencia solo consulta (diagrama de contexto v9). Pierde aprobar, cerrar, cancelar, gestionar catálogo y ajustar inventario.
2. Ajustes de inventario y alta de materiales pasan a Administración.
3. Gestión de catálogo pasa a Operaciones.
4. Administración ve cotizaciones porque cotizacion:ver gobierna los costos de los consumos (decisión del módulo 4).
5. Una orden por cotización (cotizacion_id único). La reapertura usa una versión corregida de la cotización.
6. Producción no ve inventario (Tabla 14). Pierde orden:entregar; la entrega la registran Operaciones y Atención al cliente.
