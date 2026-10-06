# Módulo 1: Clientes

Estado: diseño auditado por Codex y Gemini Pro. Fecha: 2026-10-06.
Criterio de aceptación: CF-11. Requerimientos: R-13, R-01. Apoya CF-09.
Fuentes: tesis V6 secciones 1.7 y 2.6, Anexo C (P6, Tabla C3 R-13), Anexo D (A11).
Supuestos: SD-12, SD-25 (docs/supuestos.md).

## Alcance
Incluye registrar, consultar, editar, archivar y reactivar clientes.
Incluye la ficha con el historial de cotizaciones y trabajos de cada cliente.
No incluye CRM avanzado: seguimiento comercial, embudos ni campañas (R-16, fuera de alcance).

## Modelo (ya existe, sin cambios)
Tabla `cliente`: nombre, tipo (PERSONA o EMPRESA), ruc opcional único, contactoPrincipal, telefono, correo, direccion, notas, activo, creadoEn, actualizadoEn.
Restricciones en base de datos: nombre no vacío, teléfono o correo obligatorio, correo con arroba, RUC único.
Endurecimiento nuevo (migración propia del orquestador, ver Auditoría): teléfono y correo no vacíos cuando existen, correo en minúsculas sin espacios.
Eventos de bitácora: entidad CLIENTE con acciones CREAR, EDITAR, ARCHIVAR, REACTIVAR. `ordenId` y `cotizacionId` quedan nulos.

## Permisos (matriz aprobada)
| Permiso | Gerencia | Ventas | Producción | Administración |
|---|---|---|---|---|
| cliente:ver | sí | sí | no | no |
| cliente:gestionar | no | sí | no | no |

Gerencia consulta y no modifica. Producción y Administración no ven el módulo.

## API bajo /api/v1/clientes
| Método y ruta | Permiso | Resultado |
|---|---|---|
| GET /clientes | cliente:ver | Lista paginada con búsqueda y filtros |
| POST /clientes | cliente:gestionar | 201 con el cliente creado |
| GET /clientes/[id] | cliente:ver | Cliente. Cada sección del historial exige además su permiso (ver abajo) |
| PATCH /clientes/[id] | cliente:gestionar | Cliente editado |
| POST /clientes/[id]/archivar | cliente:gestionar | Cliente con activo falso |
| POST /clientes/[id]/reactivar | cliente:gestionar | Cliente con activo verdadero |

Lista: parámetros `q`, `tipo`, `activo` (activos por defecto), `pagina`, `porPagina` (20 por defecto, máximo 100), orden por nombre y luego por id para resolver nombres iguales. Cada fila incluye el conteo de cotizaciones solo si el actor tiene cotizacion:ver.
Búsqueda `q`: coincidencia parcial sin distinguir mayúsculas en nombre, RUC, contacto principal y correo.
Historial en GET /clientes/[id], cada sección con su permiso:
- Cotizaciones (exige cotizacion:ver): id, número, asunto, estado, total y fecha. La fecha es fechaEmision y, en BORRADOR, creadoEn. Las 20 más recientes, con "mostrando N de M".
- Trabajos (exige orden:ver): id, número, estado y fecha de entrega de las órdenes de esas cotizaciones. Las 20 más recientes, con "mostrando N de M".
- Resumen (exige cotizacion:ver): cotizaciones por estado y suma de totales aprobados, calculados con agregación sobre todo el historial, no sobre las 20 mostradas.
- Actividad (exige cliente:ver): últimos 20 eventos de bitácora de entidad CLIENTE con el actor.
Una sección sin permiso no se devuelve ni se muestra. Los identificadores permiten enlazar a /cotizaciones/[id] y /ordenes/[id].

## Reglas de negocio
1. Nombre obligatorio, sin espacios sobrantes, hasta 200 caracteres.
2. Las cadenas vacías o de solo espacios se convierten en nulo antes de validar. Aplica a teléfono, correo, RUC, contacto, dirección y notas.
3. Teléfono o correo obligatorio. Se valida sobre el cliente resultante, no solo sobre los campos enviados. La base lo exige y el servicio devuelve error por campo.
4. RUC opcional. Se normaliza a mayúsculas sin espacios. Un RUC repetido devuelve 409 DUPLICADO.
5. El correo se guarda en minúsculas y con formato válido.
6. Longitudes máximas como en la base: nombre 200, RUC 20, contacto 120, teléfono 30, correo 254.
7. Nunca se borra un cliente. Se archiva. Un cliente archivado conserva su historial y no se puede elegir en una cotización nueva (regla que aplicará el módulo de cotizaciones). Archivar con cotizaciones abiertas está permitido.
8. Editar un cliente archivado no está permitido. Se reactiva primero.
9. PATCH solo acepta nombre, tipo, RUC, contacto, teléfono, correo, dirección y notas. Un campo omitido no cambia. Un campo con nulo o vacío se borra. No acepta activo, id ni marcas de tiempo.
10. Edición concurrente atómica: el cuerpo de PATCH incluye `version` (el `actualizadoEn` leído). La escritura es un UPDATE condicionado a id, activo verdadero y version igual. Si afecta cero filas responde 409 CONFLICTO_EDICION con mensaje legible. Cada cambio produce una versión estrictamente mayor que la anterior. Archivar y reactivar usan la misma condición.
11. Cada cambio escribe su evento de bitácora en la misma transacción. Si falla la bitácora, se revierte el cambio. EDITAR guarda solo los campos cambiados, con valor anterior y nuevo.
12. Los documentos asociados muestran siempre el nombre y los datos actuales del cliente. No se guarda una copia histórica (decisión ADR-011, ver Auditoría).

## Pantallas (todas bajo (app)/clientes)
| Ruta | Contenido |
|---|---|
| /clientes | Tabla con nombre, tipo, contacto, teléfono, número de cotizaciones, estado. Búsqueda, filtros, paginación. Botón "Nuevo cliente" solo con cliente:gestionar |
| /clientes/nuevo | Formulario con validación por campo |
| /clientes/[id] | Ficha: datos, resumen, tabla de cotizaciones, tabla de trabajos, actividad (línea de tiempo de bitácora) |
| /clientes/[id]/editar | Formulario precargado |

Los enlaces de la ficha apuntan a /cotizaciones/[id] y /ordenes/[id]. Esas pantallas llegan en los módulos 2 y 3.
Los botones de gestión no aparecen para Gerencia. El servidor igual rechaza la acción.
Estados vacío, carga y error usan los componentes comunes.

## Pruebas
| Nivel | Casos |
|---|---|
| Unitaria | Esquemas zod y normalización (RUC, correo, nombre) |
| Integración | Crear, editar, archivar, reactivar con su bitácora; RUC duplicado; sin medio de contacto; teléfono vacío rechazado; PATCH que deja al cliente sin contacto; búsqueda y paginación con nombres iguales; reversión si falla la bitácora |
| Concurrencia | Dos PATCH simultáneos con la misma versión: uno gana y el otro recibe 409. Editar frente a archivar |
| CF-11 | Dos clientes distintos con cotizaciones y órdenes propias: cada ficha muestra solo lo suyo. El historial se conserva tras archivar. Los totales cubren todo el historial aunque se muestren 20 |
| Permisos | Revocar cotizacion:ver u orden:ver en la matriz oculta esa sección de la ficha. PATCH, archivar y reactivar rechazados con 403 para Gerencia, Producción y Administración |
| API por perfil | Gerencia: GET sí, escritura 403. Ventas: todo sí. Producción y Administración: 403. Sin sesión: 401 |
| E2E | Ventas crea, edita, busca y archiva. Gerencia ve la ficha sin botones. Producción termina en /sin-acceso. axe en lista y formulario |
| Visual CF-11 | Captura de la ficha con cotizaciones y trabajos asociados en 4 tamaños |

## Archivos del módulo
src/modules/clientes/ (schema, service, repo, tipos, componentes), src/app/api/v1/clientes/**, src/app/(app)/clientes/**, tests/unit/clientes-*.test.ts, tests/integration/clientes-*.test.ts, e2e/clientes.spec.ts.
No cambia el schema de Prisma, los permisos ni el layout.

## Criterios de cierre
Pruebas en verde, lint y typecheck limpios, revisión cruzada, captura de CF-11 y fila actualizada en docs/trazabilidad.md.

## Auditoría
Auditores de proveedores distintos: Codex arquitecto (OpenAI) y Gemini Pro (Google). Cada hallazgo se verificó en el código.

| Hallazgo | Origen | Decisión |
|---|---|---|
| Escritura concurrente no atómica | Codex, alta | Adoptado. Regla 10 |
| Ficha devuelve historial con un solo permiso | Codex, alta | Adoptado. Secciones con permiso propio. Con la matriz por defecto no hay fuga; el riesgo aparece al revocar permisos |
| Teléfono vacío pasa el CHECK; PATCH sin contrato | Codex, media | Adoptado. Reglas 2, 3 y 9. Verificado en prisma/sql/restricciones.sql línea 44 |
| Correo sin CHECK de minúsculas, a diferencia de usuario | Gemini, media | Adoptado. Migración de endurecimiento. Verificado en restricciones.sql línea 26 frente a 46 |
| Datos históricos del cliente cambian al editarlo | Codex, media | Decisión ADR-011: se muestran datos actuales. No es un sistema fiscal y las cotizaciones ya congelan montos. Costo: una proforma impresa más tarde muestra el nombre vigente |
| Contratos de lectura y paginación incompletos | Codex, media | Adoptado. Sección API |
| Pruebas no demuestran CF-11 ni concurrencia | Codex, media | Adoptado. Sección Pruebas |
| Citar S-13 y SD-12 a la vez | Gemini, baja | Adoptado. Se cita SD-12 |
| Índice trigrama para la búsqueda | Gemini | Rechazado. Volumen de cientos de clientes (S-19). Sobreingeniería |
| Versión entera en lugar de actualizadoEn | Gemini | Rechazado. Exigiría cambiar el schema. La condición atómica de la regla 10 resuelve el problema |

Cobertura de la tesis según Gemini: CF-11 y R-13 cubiertos. Codex: dictamen "reconsiderar antes de programar" por dos altos, resueltos en este diseño.
