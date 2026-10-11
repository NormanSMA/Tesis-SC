# Matriz de trazabilidad (tesis v9)

Fuente de los códigos y las medidas: `docs/analisis/06-requisitos-v9.md` (verificada contra la tesis v9).
Historial con los códigos CF y R de la versión 6: `docs/trazabilidad-v6-historico.md`.
Fecha de la matriz: 2026-10-10.

## Criterios de estado
- Cubierto: hay implementación y al menos una prueba automatizada que la ejerce.
- Parcial: falta una prueba o una parte de la medida.
- Pendiente: no hay evidencia.

Las rutas son relativas a la raíz del repositorio. Las restricciones de base de datos están en `prisma/sql/restricciones.sql` y en `prisma/migrations/`.

## Requisitos funcionales (RF-01 a RF-10)

| Código | Atributo y medida | Implementación | Pruebas | Estado | Nota |
|---|---|---|---|---|---|
| RF-01 | Integridad del expediente. 100 % de cotizaciones y órdenes del cliente en su expediente; sin expedientes duplicados. | Módulo Clientes: `src/modules/clientes/repo.ts` (`cotizacionesDeCliente`, `ordenesDeCliente`), `src/modules/clientes/service.ts`. Base: `cliente_codigo_cliente_key` y `cliente_ruc_key` (únicos), `cliente_codigo_formato` (`prisma/migrations/20261010100200_cliente_codigo_producto_costo/migration.sql`). | `tests/integration/clientes-historial.test.ts`; `tests/integration/clientes-servicio.test.ts`; `tests/integration/clientes-api-perfiles.test.ts`; `e2e/clientes.spec.ts` | Cubierto | La prueba de historial compara el expediente de dos clientes con 27 y 22 registros, sin mezcla. |
| RF-02 | Exactitud de cotización. 100 % de conceptos aparecen; total = suma de importes. | `src/core/costeo.ts`; `src/modules/cotizaciones/calculo.ts`; `src/modules/cotizaciones/costear.ts`. Base: `linea_importe`, `cotizacion_aritmetica`, `cotizacion_montos_no_negativos` y la verificación de suma al enviar en `fn_cotizacion_congelar`. | `tests/unit/costeo.test.ts`; `tests/unit/cotizaciones-calculo.test.ts`; `tests/integration/costeo-paridad-bd.test.ts`; `tests/integration/cotizaciones-servicio.test.ts`; `tests/integration/cotizaciones-estados.test.ts`; `e2e/cotizaciones.spec.ts` | Cubierto | La paridad con la base usa casos aleatorios con semilla fija. |
| RF-03 | Conversión cotización-orden. 100 % de aprobadas generan una sola orden; no aprobadas no generan. | `src/modules/ordenes/conversion.ts`; `src/modules/ordenes/service.ts`. Base: `orden_trabajo_cotizacion_id_key` (única) y trigger `trg_orden_exige_aprobada` (SC004). | `tests/integration/ordenes-conversion.test.ts`; `tests/integration/errores-bd.test.ts` (SC004); `tests/integration/ordenes-api-perfiles.test.ts`; `e2e/ordenes.spec.ts` | Cubierto | Incluye conversiones simultáneas con un solo ganador. |
| RF-04 | Continuidad de información. Cliente, id de cotización y conceptos coinciden en 100 % de órdenes. | `src/modules/ordenes/conversion.ts`; `src/modules/ordenes/estimado.ts`; `src/core/consumo-estimado.ts`. Base: llave compuesta `orden_trabajo_cotizacion_id_cliente_id_fkey` (`prisma/migrations/20261010100500_orden_cliente_responsable_opcional/migration.sql`). | `tests/integration/ordenes-conversion.test.ts` (cliente de la orden igual al de la cotización); `tests/integration/seed.test.ts` (paridad del estimado); `tests/unit/consumo-estimado.test.ts`; `e2e/ordenes.spec.ts` (conversión sin reingreso de ítems) | Cubierto | La prueba compara el cliente y la cotización de origen; los conceptos se verifican por el estimado derivado. |
| RF-05 | Exactitud de existencias. Existencia final = inicial + entradas - salidas, en 100 % de pruebas. | `src/modules/inventario/libro.ts`; `src/modules/inventario/service.ts`. Base: libro de movimientos con `fn_movimiento_aplicar`, `trg_material_proteger_saldo` (SC006) y `movimiento_signo_por_tipo`. | `tests/integration/inventario-libro.test.ts`; `tests/integration/inventario-concurrencia.test.ts`; `tests/integration/seed.test.ts` (saldo igual a la suma acumulada del libro); `tests/integration/errores-bd.test.ts` (SC006); `e2e/inventario.spec.ts` | Cubierto | La existencia solo cambia por el libro. |
| RF-06 | Control de consumo. 100 % de consumos con material, cantidad y orden; ninguna existencia negativa. | `src/modules/inventario/consumo.ts`; `src/modules/inventario/consumo-validacion.ts`. Base: `consumo_orden` (cantidad, orden, material), `material_existencia_no_negativa`, trigger `trg_consumo_validar` (SC005). | `tests/integration/inventario-consumo-servicio.test.ts`; `tests/integration/inventario-consumo-api.test.ts`; `tests/integration/inventario-concurrencia.test.ts`; `tests/unit/inventario-consumo-reglas.test.ts`; `e2e/inventario-orden.spec.ts` | Cubierto | Un consumo mayor que la existencia se rechaza sin cambiar el saldo. |
| RF-07 | Seguimiento de producción. 100 % de cambios válidos actualiza etapa, responsable y fecha-hora. | `src/modules/produccion/etapas.ts`; `src/modules/produccion/escritura.ts`; tabla `historial_etapa` (`prisma/migrations/20261011015300_historial_etapa_restricciones_v9/migration.sql`). Base: `trg_etapa_transicion` y `transicion_valida`. | `tests/integration/produccion-servicio.test.ts`; `tests/integration/produccion-historial.test.ts`; `tests/integration/produccion-api-perfiles.test.ts`; `tests/integration/produccion-concurrencia.test.ts`; `e2e/produccion.spec.ts` | Cubierto | Iniciar sin responsable se rechaza con 409. |
| RF-08 | Trazabilidad. 100 % de eventos consultables en orden cronológico, sin sobrescribir. | `src/modules/trazabilidad/repo.ts`; `src/modules/trazabilidad/costos.ts`; `src/lib/bitacora.ts`. Base: triggers de solo inserción en `bitacora` (`trg_bitacora_solo_insercion`, SC001). | `tests/integration/trazabilidad-consulta.test.ts`; `tests/integration/trazabilidad-api-perfiles.test.ts`; `tests/integration/errores-bd.test.ts` (SC001); `tests/integration/roles.test.ts`; `e2e/trazabilidad.spec.ts` | Cubierto | El orden usa fecha y desempate por id. |
| RF-09 | Información operativa. Datos del panel = 100 % de registros activos de la prueba. | `src/modules/panel/consultas.ts`; `src/modules/panel/service.ts`; `src/modules/panel/paneles.ts`. | `tests/integration/panel-consulta.test.ts`; `tests/unit/panel-alertas.test.ts`; `tests/unit/panel-perfiles.test.ts`; `e2e/panel.spec.ts` | Cubierto | Excluye registros inactivos y oculta dinero sin permiso. |
| RF-10 | Control de acceso funcional. 100 % de operaciones permitidas se ejecuta; 100 % de no permitidas se rechaza. | `src/core/permisos.ts`; `src/core/autorizacion.ts`; `src/lib/http.ts` (`manejar`); `src/lib/auth/guardia.ts`. Módulo Administración: `src/modules/admin/permisos-service.ts`. | `tests/unit/permisos.test.ts`; `tests/unit/autorizacion.test.ts`; `tests/integration/auth-http.test.ts`; `tests/integration/ordenes-api-perfiles.test.ts`; `tests/integration/produccion-api-perfiles.test.ts`; `tests/integration/inventario-consumo-api.test.ts`; `e2e/base.spec.ts` | Cubierto | Cada API por perfil prueba el código esperado (200 o 403) por operación. |

## Requisitos no funcionales (RNF-01 a RNF-08)

| Código | Atributo y medida | Implementación | Pruebas | Estado | Nota |
|---|---|---|---|---|---|
| RNF-01 | Tiempo de respuesta. Al menos 95 % de operaciones en 2 s o menos, con 20 sesiones concurrentes. | Sin implementación específica. La medición usará `scripts/rendimiento.mjs` y se documentará en `docs/pruebas/rendimiento-RNF-01.md`. | Ninguna. | Pendiente | `scripts/rendimiento.mjs` y `docs/pruebas/rendimiento-RNF-01.md` no existen todavía. |
| RNF-02 | Autenticación. 100 % de funciones protegidas rechaza solicitudes sin sesión válida. | `src/lib/http.ts` (`manejar`); `src/lib/auth/sesion.ts`; `src/lib/auth/guardia.ts`; `src/modules/auth/service.ts`. | `tests/integration/auth-http.test.ts`; `tests/integration/auth-sesion.test.ts`; `tests/integration/auth-login.test.ts`; `tests/integration/ordenes-api-perfiles.test.ts` (todas sin sesión responden 401); `tests/integration/produccion-api-perfiles.test.ts`; `tests/integration/reportes-api.test.ts`; `e2e/base.spec.ts` | Cubierto | Cubre sesión expirada, revocada y usuario desactivado. |
| RNF-03 | Autorización. 100 % de casos no autorizados rechazado sin modificar información. | `src/core/autorizacion.ts` (`exigir`); `src/lib/http.ts` (`manejar` con permiso por acción). | `tests/integration/ordenes-api-perfiles.test.ts` (escrituras rechazadas conservan cabecera, etapas y bitácora); `tests/integration/cotizaciones-api-perfiles.test.ts` (conservan cotización y bitácora); `tests/integration/admin-permisos-api.test.ts`; `e2e/clientes.spec.ts` | Cubierto | La comprobación de no modificación está en órdenes y cotizaciones. El resto verifica el 403. |
| RNF-04 | Confidencialidad en tránsito. 100 % de conexiones HTTPS con TLS 1.2 o superior. | `src/lib/auth/cookies.ts` (atributo `Secure` con `SESSION_COOKIE_SECURE=true`); `docs/seguridad.md`. TLS lo termina el despliegue. | `tests/integration/auth-login.test.ts` (cookie `Secure` solo con `SESSION_COOKIE_SECURE`) | Parcial | La versión de TLS se verifica al desplegar. Ninguna prueba automatizada la mide. |
| RNF-05 | Integridad transaccional. Cero órdenes duplicadas, cero registros huérfanos, cero existencias negativas. | `orden_trabajo_cotizacion_id_key`; `material_existencia_no_negativa`; triggers `trg_movimiento_exige_consumo` y `trg_consumo_validar` (SC005); llaves foráneas con `ON DELETE RESTRICT`; bitácora en la misma transacción. | `tests/integration/errores-bd.test.ts`; `tests/integration/ordenes-conversion.test.ts`; `tests/integration/inventario-concurrencia.test.ts`; `tests/integration/produccion-historial.test.ts`; `scripts/prueba-recuperacion.sh` | Cubierto | El script de recuperación verifica huérfanos, duplicados y existencias en la base restaurada. |
| RNF-06 | Respaldo. Al menos un respaldo exitoso cada 24 horas. | `scripts/respaldo.sh`; `scripts/respaldo-programado.sh`; servicio `respaldo` en `compose.yaml`. | `scripts/prueba-recuperacion.sh`; evidencia en `docs/pruebas/respaldo-RNF-06-07.md` | Cubierto | Depende de que el servicio `respaldo` esté activo. Falta copiar el volumen `sc_respaldos` a otro equipo. |
| RNF-07 | Recuperabilidad. Restauración sin errores de integridad en máximo 4 horas. | `scripts/restaurar.sh`; `scripts/prueba-recuperacion.sh`. | `scripts/prueba-recuperacion.sh`; evidencia en `docs/pruebas/respaldo-RNF-06-07.md` | Cubierto | Restauración en 2 s con datos de demostración (límite 14 400 s). El tiempo crece con el volumen. |
| RNF-08 | Adaptabilidad. Flujos críticos en 768, 1024, 1366 y 1920 px sin superposición ni desplazamiento horizontal. | `src/app/(app)/layout.tsx`; `src/components`; riel de íconos y panel lateral (ver `e2e/diseno.spec.ts`). | `e2e/base.spec.ts` (desborde en 4 tamaños); `e2e/diseno.spec.ts`; `e2e/clientes.spec.ts`; `e2e/ordenes.spec.ts`; `e2e/panel.spec.ts`; `e2e/produccion.spec.ts` | Parcial | Los E2E usan 1920, 1366, 1024 y 820 px (`e2e/ayudas.ts`, `playwright.config.ts`). Ninguno usa 768 px de ancho. Ninguna prueba mide superposición. |

## Reglas de negocio (RB-01 a RB-10)

| Código | Regla y criterio | Implementación | Pruebas | Estado | Nota |
|---|---|---|---|---|---|
| RB-01 | Cliente único. No se crean dos clientes con el mismo identificador interno. | `cliente_codigo_cliente_key` (único), `siguiente_codigo_cliente()` y `cliente_codigo_formato`; `cliente_ruc_key`. `src/modules/clientes/service.ts`. | `tests/integration/clientes-servicio.test.ts` (código único; 409 DUPLICADO por RUC); `tests/integration/errores-bd.test.ts` (23505); `e2e/clientes.spec.ts` | Cubierto | El código se asigna en la base y no se edita. |
| RB-02 | Cotización con cliente. 100 % de cotizaciones con referencia válida a cliente. | Columna `cliente_id` obligatoria en `cotizacion` con llave foránea (`prisma/schema.prisma`); `src/modules/cotizaciones/service.ts`. | `tests/integration/cotizaciones-servicio.test.ts` (rechaza cliente archivado); `tests/integration/clientes-historial.test.ts`; `e2e/cotizaciones.spec.ts` | Cubierto | Ninguna prueba intenta insertar una cotización sin cliente directamente en la base. |
| RB-03 | Total de cotización. Total = suma de importes de conceptos, en 100 % de casos. | `cotizacion_aritmetica`, `linea_importe`, `item_importe_catalogo`; `fn_cotizacion_congelar`; `src/core/costeo.ts`. | `tests/integration/costeo-paridad-bd.test.ts` (control: la base rechaza un centavo de diferencia); `tests/integration/cotizaciones-estados.test.ts` (rechaza enviar con suma distinta); `tests/unit/costeo.test.ts` | Cubierto | Usa aritmética decimal exacta. |
| RB-04 | Orden solo desde aprobada. Rechaza 100 % de intentos desde estados distintos de aprobado. | Trigger `trg_orden_exige_aprobada` (SC004); `src/modules/ordenes/conversion.ts`; `src/modules/cotizaciones/estados.ts`. | `tests/integration/errores-bd.test.ts` (SC004); `tests/integration/ordenes-conversion.test.ts` (borrador; trigger real con lectura alterada); `tests/integration/cotizaciones-v9.test.ts` | Cubierto | La base rechaza aunque el servicio falle. |
| RB-05 | Orden activa única. Repetir la operación no genera segunda orden activa. | Índice único `orden_trabajo_cotizacion_id_key`; `src/modules/ordenes/conversion.ts`. | `tests/integration/ordenes-conversion.test.ts` (doble conversión, UNIQUE real, dos conversiones simultáneas); `tests/integration/ordenes-api-perfiles.test.ts` (409 con el número existente); `e2e/ordenes.spec.ts` | Cubierto | La respuesta repetida informa el número de la orden existente. |
| RB-06 | Consumo transaccional. Existencia = saldo calculado tras cada consumo; nunca negativa. | `fn_movimiento_aplicar`; `material_existencia_no_negativa`; `src/modules/inventario/consumo.ts`; `src/modules/inventario/consumo-bloqueo.ts`. | `tests/integration/inventario-concurrencia.test.ts` (N consumidores no superan la existencia); `tests/integration/inventario-consumo-servicio.test.ts`; `tests/integration/errores-bd.test.ts` (23514); `tests/integration/seed.test.ts` | Cubierto | Consumos cruzados no se interbloquean. |
| RB-07 | Consumo ligado a orden. 100 % de consumos con referencia válida a orden. | `consumo_orden` con orden obligatoria; triggers `trg_movimiento_exige_consumo` y `trg_consumo_validar` (SC005); `src/modules/inventario/consumo-validacion.ts`. | `tests/integration/errores-bd.test.ts` (SC005, consumo sin orden); `tests/integration/inventario-consumo-api.test.ts` (404 con orden inexistente); `tests/integration/inventario-consumo-servicio.test.ts` | Cubierto | Un consumo sin orden falla al confirmar la transacción. |
| RB-08 | Etapa con responsable y fecha-hora. 100 % de cambios contiene los tres datos en el historial. | Tabla `historial_etapa` (etapa, usuario, responsable, `creado_en`); `src/modules/produccion/etapas.ts`; `src/modules/produccion/escritura.ts`. | `tests/integration/produccion-historial.test.ts`; `tests/integration/produccion-servicio.test.ts`; `e2e/produccion.spec.ts` | Parcial | `responsable_id` admite nulo. Omitir, restaurar y retirar responsable guardan filas con responsable nulo. Ninguna restricción de base lo exige. |
| RB-09 | Historial no sustituible. Un nuevo evento no modifica eventos previos. | Triggers `trg_historial_etapa_solo_insercion` y `trg_historial_etapa_sin_truncate`; `trg_bitacora_solo_insercion` (SC001). | `tests/integration/produccion-historial.test.ts` (UPDATE y DELETE rechazados con SC001); `tests/integration/errores-bd.test.ts` (SC001); `tests/integration/roles.test.ts` | Cubierto | Aplica también a movimientos y consumos. |
| RB-10 | Operaciones según rol. 100 % de pruebas de autorización coincide con la matriz rol-permiso. | `src/core/permisos.ts` (matriz por defecto); tablas `perfil_permiso` y `usuario_perfil`; `docs/modulos/09-perfiles-v9.md`. | `tests/unit/permisos.test.ts` (cada perfil recibe exactamente los permisos de su columna); `tests/integration/ordenes-api-perfiles.test.ts`; `tests/integration/cotizaciones-api-perfiles.test.ts`; `tests/integration/cotizaciones-v9.test.ts`; `e2e/base.spec.ts` | Cubierto | Las pruebas por perfil usan tablas de códigos esperados por operación. |

## Resumen de estados
- Cubierto: 24 (RF-01 a RF-10; RNF-02, RNF-03, RNF-05, RNF-06, RNF-07; RB-01 a RB-07, RB-09, RB-10).
- Parcial: 3 (RNF-04, RNF-08, RB-08).
- Pendiente: 1 (RNF-01).

## Mapeo de códigos antiguos
Fuente: `docs/analisis/06-requisitos-v9.md`. Los códigos CF y R pertenecen a la versión 6 de la tesis.

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

## Brechas abiertas
1. RNF-01: no hay medición. Crear `scripts/rendimiento.mjs` (20 sesiones concurrentes, percentil 95 en 2 s) y registrar el resultado en `docs/pruebas/rendimiento-RNF-01.md`.
2. RNF-04: ninguna prueba automatizada verifica TLS 1.2 o superior. Verificar al desplegar y activar `SESSION_COOKIE_SECURE=true`.
3. RNF-08: alinear los E2E a 768, 1024, 1366 y 1920 px. Hoy la tableta vertical usa 820 px en `e2e/ayudas.ts` y `e2e/diseno.spec.ts`. Ninguna prueba mide superposición.
4. RB-08: `historial_etapa.responsable_id` admite nulo. Decidir si omitir y restaurar requieren responsable o si la medida admite esos casos.
5. RNF-03: la comprobación de no modificación existe en órdenes y cotizaciones. Extenderla a clientes, inventario, producción y catálogo.
6. RB-02: falta una prueba que intente insertar una cotización sin cliente directamente en la base.
7. RNF-06: copiar el volumen `sc_respaldos` fuera del equipo del servidor para la operación real.
8. Los archivos de captura en `docs/capturas/` conservan nombres con códigos CF (por ejemplo `CF-01-gerencia-escritorio.png`). Renombrar al regenerarlos.

## Funcionalidad fuera de v9 que el sistema ya cubre
Lo siguiente no tiene código v9 propio. Las pruebas existen y se listan en `docs/trazabilidad-v6-historico.md`.

| Funcionalidad | Implementación | Pruebas |
|---|---|---|
| Reutilización de cotizaciones: duplicar borrador y versión corregida (antes R-02) | `src/modules/cotizaciones/service.ts` (`duplicarCotizacion`); `src/app/api/v1/cotizaciones/[id]/duplicar` | `tests/integration/cotizaciones-v9.test.ts`; `tests/integration/cotizaciones-instantaneas.test.ts`; `e2e/cotizaciones.spec.ts` |
| Proforma imprimible | `src/modules/cotizaciones/componentes/ImprimirProforma.tsx` | `e2e/cotizaciones.spec.ts` (vista de impresión) |
| Reportes JSON y CSV con exportación protegida (antes R-11) | `src/modules/reportes/csv.ts`; `src/modules/reportes/service.ts` | `tests/integration/reportes-api.test.ts`; `tests/unit/reportes-csv.test.ts`; `tests/unit/reportes-reglas.test.ts`; `e2e/panel.spec.ts` |
| Catálogo de productos con receta y etapas por servicio | `src/modules/catalogo/`; `src/modules/produccion/plantillas.ts` | `tests/integration/catalogo-servicio.test.ts`; `tests/integration/produccion-catalogos.test.ts`; `e2e/catalogo.spec.ts` |
| Costo promedio, alertas de stock mínimo, conciliación y ajuste de inventario | `src/modules/inventario/libro.ts`; `src/modules/inventario/consulta.ts` | `tests/integration/inventario-libro.test.ts`; `tests/integration/inventario-consulta.test.ts`; `e2e/inventario.spec.ts` |
| Estimado contra consumido y ocultar costos sin permiso | `src/modules/inventario/resumen-orden.ts`; `src/core/consumo-estimado.ts` | `tests/integration/inventario-consumo-servicio.test.ts`; `e2e/inventario-orden.spec.ts` |
| Asignar, omitir, retrabajo y tablero de producción | `src/modules/produccion/` | `tests/integration/produccion-servicio.test.ts`; `e2e/produccion.spec.ts` |
| Idempotencia de escrituras de inventario | `src/modules/inventario/idempotencia.ts` | `tests/integration/inventario-idempotencia.test.ts` |
| Administración de usuarios, permisos y configuración | `src/modules/admin/` | `tests/integration/admin-usuarios-api.test.ts`; `tests/integration/admin-permisos-api.test.ts`; `tests/integration/admin-configuracion-api.test.ts` |
| Accesibilidad WCAG 2.2 AA con axe | `src/components`; `src/app/(app)/layout.tsx` | `e2e/base.spec.ts`; `e2e/diseno.spec.ts`; `e2e/ayudas.ts` |
| Despliegue reproducible, siembra de datos ficticios y secretos fuera del repositorio | `compose.yaml`; `Dockerfile`; `prisma/seed/`; `.env.example` | `tests/integration/seed.test.ts`; `tests/unit/seed-datos.test.ts`; `tests/unit/seed-calculos.test.ts` |
