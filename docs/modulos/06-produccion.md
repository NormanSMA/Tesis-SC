# Módulo 5: Producción por etapas

Estado: diseño auditado por Codex y Gemini Pro. Fecha: 2026-10-06.

Actualización documental v9: 2026-10-11.
Aplique los permisos actuales; conserve las auditorías y cifras de cierre como antecedentes.
Use anchos E2E de 768, 1024, 1366 y 1920 px.
Esta actualización no registra una nueva ejecución de pruebas.
Criterios de aceptación: CF-02 (completa la parte pendiente del módulo 3), CF-09. Requerimiento: R-06. Apoya CF-05, CF-06 y CF-08.
Fuentes: tesis V6 secciones 1.2, 1.7 y 2.6; Anexo C (P4, P7, Tablas C2 y C3); Anexo D (A2, A9).
Supuestos: S-03, S-07, SD-13, SD-16, SD-17, SD-23.
Modelo: docs/analisis/05-modelo-datos.md (OrdenTrabajo, EtapaOrden, EtapaPlantilla, Area, máquinas de estado de orden y etapa, I-14, I-15, I-21).
Contrato heredado: docs/modulos/04-ordenes.md (bloqueos de la fila de la orden) y docs/modulos/05-inventario.md (regla: una operación que actualiza la fila de la orden toma `FOR UPDATE` desde el inicio y no retiene bloqueos de materiales).

## Alcance
Dentro:
- Etapas de una orden: asignar responsable y fechas planificadas, agregar etapa manual, omitir y restaurar, iniciar y completar.
- Estados de la orden que dependen de las etapas: PENDIENTE a EN_PRODUCCION (automático al iniciar la primera etapa), EN_PRODUCCION a LISTA (marcar lista) y LISTA a EN_PRODUCCION (retrabajo).
- Áreas de producción y plantillas de etapas por categoría (administración desde la interfaz).
- Tablero de producción: etapas abiertas por responsable y por área, con acceso a la orden.
Fuera de alcance: entrega, cierre y cancelación (módulo 3), consumo de material (módulo 4), panel gerencial, reportes de carga y tiempos (módulo 7), notificaciones.

## Permisos vigentes (v9)

Consulte [la matriz v9](09-perfiles-v9.md) y `src/core/permisos.ts`.
Combine los permisos cuando el usuario tenga varios perfiles.

| Permiso | Gerencia | Administración | Operaciones | Atención al cliente | Producción | Administración técnica |
|---|---|---|---|---|---|---|
| produccion:ver | sí | sí | sí | sí | sí | no |
| produccion:planificar | no | sí | sí | no | no | no |
| produccion:ejecutar | no | sí | no | no | sí | no |
| orden:avanzar | no | sí | sí | no | sí | no |
| catalogo:gestionar | no | no | sí | no | no | no |

Reserve planificación para Operaciones y Administración; ejecución para Producción y Administración.
Mantenga Gerencia y Atención al cliente en consulta; restrinja Administración técnica.
El tablero y las fichas de producción no muestran dinero.

## Máquinas de estado
Las transiciones válidas las define la base (`transicion_valida`, fn_validar_transicion). El servicio agrega permisos y condiciones.
| Entidad | Desde | Hacia | Condición del servicio | Efecto |
|---|---|---|---|---|
| Etapa | PENDIENTE | EN_CURSO | Responsable asignado. Orden PENDIENTE o EN_PRODUCCION. Si la orden está PENDIENTE se exigen `produccion:ejecutar` y también `orden:avanzar` (el modelo exige `orden:avanzar` para iniciar la producción) | fechaInicioReal = ahora. Si la orden está PENDIENTE pasa a EN_PRODUCCION con fechaInicioReal = ahora |
| Etapa | EN_CURSO | COMPLETADA | | fechaFinReal = ahora |
| Etapa | PENDIENTE | OMITIDA | Motivo obligatorio. Orden PENDIENTE o EN_PRODUCCION | Fechas reales siguen nulas |
| Etapa | OMITIDA | PENDIENTE | Orden PENDIENTE o EN_PRODUCCION | |
| Orden | EN_PRODUCCION | LISTA | Todas las etapas COMPLETADA u OMITIDA y al menos una COMPLETADA (I-21 más la guarda de orden sin trabajo) | |
| Orden | LISTA | EN_PRODUCCION | Motivo obligatorio. El servicio crea una etapa de retrabajo PENDIENTE (área y nombre elegidos) en la misma transacción | |
No existen EN_CURSO a OMITIDA ni COMPLETADA a otro estado: la base lo impide. Para corregir una etapa completada por error se usa el retrabajo de la orden.
Estados de orden que no admiten cambios de etapa: ENTREGADA, CERRADA y CANCELADA. LISTA tampoco: primero se reabre con retrabajo.
Bitácora: etapa entidad ETAPA_ORDEN con `ordenId`; CAMBIAR_ESTADO con estado anterior y nuevo, ASIGNAR_RESPONSABLE y EDITAR (fechas) con antes y después, CREAR para etapas agregadas. Orden: CAMBIAR_ESTADO (y detalle.motivo en retrabajo). Todo en la misma transacción.

## Reglas de etapas
1. Responsable: usuario activo con perfil Producción. Puede reasignarse mientras la etapa no esté COMPLETADA. Obligatorio para iniciar (la base lo exige en EN_CURSO).
2. Fechas planificadas (inicio y fin, fecha de calendario, fin no anterior al inicio) editables mientras la etapa no esté COMPLETADA u OMITIDA. Sin cambios reales no se avanza versión ni se escribe bitácora.
3. Agregar etapa manual: nombre (80), área activa, queda al final (secuencia = máxima + 1), sin plantilla. Solo con la orden PENDIENTE o EN_PRODUCCION.
4. No se impone secuencia estricta: varias etapas pueden estar EN_CURSO a la vez (por ejemplo impresión y carpintería). La secuencia ordena la presentación.
5. Versión optimista: las acciones de etapa usan la versión propia de la etapa (`actualizadoEn`, columna que ya existe en `etapa_orden`; no se migra) y no validan la versión de la orden, para que etapas distintas de una misma orden no choquen entre sí. Marcar lista y retrabajo usan la versión de la orden. UPDATE condicionado a id, estado y versión, con el avance monotónico en milisegundos del escritor de órdenes. El DTO de etapa incluye `actualizadoEn`. Al iniciar la primera etapa, el instante "ahora" se toma después de adquirir el bloqueo, y el segundo inicio concurrente conserva la `fechaInicioReal` de la orden.
6. Contrato de bloqueo: toda operación de etapa o de orden empieza con `SELECT ... FOR UPDATE` de la fila de la orden, relee su estado y después bloquea la etapa. Nunca toma bloqueos de materiales. Un consumo concurrente (FOR SHARE de la orden) espera o procede en orden; la cancelación (UPDATE) también. Consumo y marcar lista pueden confirmar ambos (EN_PRODUCCION y LISTA admiten consumo); marcar lista comprueba las etapas bajo el bloqueo. Las órdenes terminales (ENTREGADA, CERRADA, CANCELADA) no cuentan como carga: el tablero y las comprobaciones de archivo las excluyen aunque conserven etapas EN_CURSO.
7. Cuando completar una etapa deja todas cerradas, la orden no pasa a LISTA sola: la persona decide con "Marcar lista". La interfaz lo sugiere.

## Áreas y plantillas
Áreas (`area`): nombre único (80), activo. Operaciones crea, edita nombre y archiva. Un área no se archiva (409 AREA_EN_USO) si tiene plantillas activas o etapas abiertas de órdenes no terminales. La conversión de órdenes (módulo 3) valida bajo bloqueo que el área de cada plantilla siga activa. Bitácora: se agrega el valor AREA al enum de entidades de bitácora, con CREAR, EDITAR, ARCHIVAR y REACTIVAR.
Migración del módulo (la hace el orquestador): `ALTER TYPE entidad_bitacora ADD VALUE 'AREA'`; columna `actualizado_en` (timestamptz, default now) en `area` y en `etapa_plantilla` para la versión optimista de su edición.
Plantillas (`etapa_plantilla`): por categoría, secuencia única, nombre, área activa, activo. Operaciones agrega, edita, reordena (cambia secuencia) y archiva. Reordenar bloquea la categoría y mueve las secuencias por posiciones temporales altas libres (el UNIQUE de categoría y secuencia es inmediato y un intercambio directo daría 23505) antes de fijar las finales, todo en una transacción. Cambiar una plantilla no altera órdenes existentes: las etapas son una copia (snapshot). Bitácora: acción EDITAR sobre la entidad CATEGORIA con `entidadId` de la categoría y la operación y la plantilla (antes y después) en `detalle`; archivar una plantilla no se representa como archivar la categoría.
Versión optimista en edición de áreas y plantillas. La conversión de órdenes (módulo 3) exige al menos una plantilla activa.

## API bajo /api/v1
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /produccion/tablero | produccion:ver | Etapas abiertas de órdenes no terminales agrupadas por área y por responsable. Filtros: área, responsable, estado, texto de orden |
| GET /ordenes/[id]/etapas | produccion:ver | Etapas con responsable y fechas |
| POST /ordenes/[id]/etapas | produccion:planificar | Agrega etapa manual. 201 |
| PATCH /etapas/[id] | produccion:planificar | Responsable y fechas planificadas. Exige version |
| POST /etapas/[id]/iniciar, /completar | produccion:ejecutar | Exige version |
| POST /etapas/[id]/omitir, /restaurar | produccion:planificar | Omitir exige motivo. Exige version |
| POST /ordenes/[id]/lista | orden:avanzar | Marca lista. Exige version de la orden |
| POST /ordenes/[id]/retrabajo | orden:avanzar | Motivo, área y nombre de la etapa. Exige version |
| GET, POST /areas; PATCH /areas/[id]; POST /areas/[id]/archivar y /reactivar | produccion:ver (GET), catalogo:gestionar | Áreas |
| GET /categorias/[id]/plantillas; POST; PATCH /plantillas/[id]; POST /plantillas/[id]/archivar | produccion:ver (GET), catalogo:gestionar | Plantillas |
Formato de AGENTS.md. Errores nuevos: ETAPA_SIN_RESPONSABLE, ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA, ETAPAS_ABIERTAS, ORDEN_SIN_TRABAJO, AREA_EN_USO. El escritor de órdenes del módulo 3 (src/modules/ordenes/repo.ts) se extiende para fijar `fechaInicioReal` al pasar a EN_PRODUCCION y conservarla en el retrabajo, como exigen los CHECK de fechas por estado.

## Pantallas
- /produccion: tablero con dos vistas (por responsable y por área) de las etapas abiertas, con estado en texto, fechas planificadas y atraso. Para Producción incluye el atajo "Mis etapas". Acciones directas Iniciar y Completar por fila para quien tiene `produccion:ejecutar`.
- /ordenes/[id]: la sección Etapas (hoy de solo lectura) gana acciones por fila según permiso y estado: asignar, fechas, iniciar, completar, omitir, restaurar; botón "Agregar etapa"; botones "Marcar lista" y "Reabrir por retrabajo" con diálogo de motivo.
- /produccion/areas y /produccion/plantillas: gestión por Operaciones; consulta según `produccion:ver`.
Cumple WCAG 2.2 AA, 4 viewports, sin desborde horizontal. Cada acción se deshabilita mientras la solicitud está en curso y los errores se anuncian con aria-live.

## Invariantes que cubre
I-14, I-15, I-17, I-19, I-20, I-21, y las guardas de bloqueo del módulo 4. CF-02, CF-09, R-06.

## Pruebas
- Unitarias: reglas de transición de etapa y de orden, guarda de LISTA (todas cerradas y al menos una completada), esquemas zod.
- Prueba transversal de CF-09: conversión, consumo de material, ejecución de etapas y consulta vinculada de cliente, cotización, orden, materiales y producción, con captura.
- Integración (base propia pro_test): flujo completo (asignar, iniciar la primera etapa lleva la orden a EN_PRODUCCION, completar, omitir, marcar lista, retrabajo con etapa nueva, entrega); permisos por perfil; versión vieja; responsable inválido o inactivo; etapa sin responsable; orden en estados que no admiten cambios; áreas con etapas abiertas; plantillas (copia, no altera órdenes existentes); bitácora en la misma transacción con una fila por evento; concurrencia: dos inicios de la primera etapa a la vez (una sola transición de la orden y fechaInicioReal estable), iniciar contra cancelar, consumir contra marcar lista, iniciar y completar contra cancelar, agregar o restaurar etapa contra marcar lista, entregar contra retrabajo, dos usuarios completando la misma etapa, etapas iguales y distintas, sin interbloqueo.
- API por perfil: matriz de permisos, 401, 403, 404, 409, 422.
- E2E: Operaciones planifica; Producción inicia, completa y marca lista.
  Permita planificación y ejecución a Administración; mantenga Gerencia y Atención al cliente en consulta.
  Reserve gestión de áreas y plantillas para Operaciones.
  Consulte errores sin responsable, retrabajo, axe, desbordes y capturas CF-02 en cuatro tamaños.

## Auditoría (2026-10-06)
Auditores de dos proveedores: Codex arquitecto y Gemini Pro. Ninguno halló un defecto alto demostrado.
Adoptado:
- `etapa_orden.actualizado_en` ya existe: no se migra (ambos, verificado en schema.prisma). Se migran `area` y `etapa_plantilla` (versión) y el valor AREA del enum de bitácora (ambos).
- Guarda de LISTA: al menos una etapa COMPLETADA (ambos). Todas omitidas deja una orden sin trabajo; se cancela.
- Etapas EN_CURSO simultáneas, sin secuencia estricta (ambos; R-06 no define precedencias).
- Retrabajo con etapa nueva; COMPLETADA no se reabre (Codex, la base lo impide). Cancelar desde LISTA ya existe.
- `FOR UPDATE` de la orden en cada acción, sin tomar materiales (ambos). `FOR SHARE` solo para acciones que nunca escriben la orden. Medir esperas más adelante.
- Primer inicio exige `produccion:ejecutar` y `orden:avanzar` (Codex).
- Reordenar plantillas con posiciones temporales (Codex). Archivo de áreas con plantillas activas y revalidación del área en la conversión (Codex).
- Tablero y archivo excluyen órdenes terminales aunque conserven etapas EN_CURSO (Codex).
- DTO de etapa con versión; versión de etapa propia sin validar la de la orden (Codex).
- Escritor de órdenes con `fechaInicioReal` (Codex).
- Prueba transversal de CF-09 y barreras observables en las pruebas de concurrencia (Codex).
Descartado: la guarda de LISTA como trigger de base (Gemini); la regla vive en el servicio con la prueba de concurrencia, igual que el resto de los invariantes de servicio. Gemini marcó el valor AREA ausente como alto, pero el diseño ya lo agrega en la migración.

## Cierre del módulo (2026-10-06)
Implementación y E2E: Codex (programar). Revisión: Gemini Pro (una pasada, sin defectos relevantes) y verificación del orquestador.
Medido: typecheck y lint limpios; 1187 pruebas unitarias e integración en 66 archivos; E2E completo 521 verdes, 0 fallos, 247 omitidas por diseño.
Hallazgo corregido: un fixture de órdenes sin `actualizadoEn` en la etapa rompía el typecheck.
Cobertura: CF-02 y R-06 implementados (Jev 0.99); CF-09 parcial (Jev 0.91) hasta la consulta global de trazabilidad (módulo 6) y el panel (módulo 7).
Pendiente conocido: las pruebas de concurrencia usan retardos y bloqueos retenidos; no hay barreras con pg_blocking_pids.
