# Contraste de la tesis v9.4 con el sistema TRACORE

Fecha: 2026-10-13.
Fuentes de la tesis: texto de la tesis v9.4 y texto de la predefensa (16 láminas).
Fuentes del sistema: repositorio `sc-plataforma`, `prisma/schema.prisma`, `docs/` y `README.md`.
Alcance: solo lectura. No se ejecutó ninguna prueba. Las cifras de pruebas vienen de los documentos del repositorio.
Regla de lectura: «no consta» significa que no hallé evidencia en el repositorio.

## 1. Resumen

- Coinciden los 10 RF, los 8 RNF, las 10 RB, la matriz de la Tabla 14 y el flujo cotización a orden.
- La trazabilidad del sistema marca 28 de 28 criterios como Cubierto (`docs/trazabilidad.md`).
- Difieren el modelo de datos (26 modelos, no 17), los ID (UUID, no bigserial) y los estados de la orden (6, no REGISTRADA).
- Difiere la pila: la tesis propone React, NestJS y TypeORM. El sistema usa Next.js 16, Prisma 7.10 y PostgreSQL 17.
- Difieren las secciones 4.7, 4.11 y 4.13: la tesis describe un prototipo y un plan. El sistema ya funciona y tiene resultados.
- El sistema tiene extras que la tesis no menciona (sección 4). Faltan en el sistema el modo oscuro, los manuales por perfil y la guía de instalación (sección 5).

## 2. La tesis dice y el sistema cumple

| Tesis (sección o código) | Sistema (archivo o prueba) | Estado |
|---|---|---|
| RF-01, RB-01 (Tablas 9 y 11): expediente único de cliente | `src/modules/clientes/repo.ts`; índice único `cliente_codigo_cliente_key`; `tests/integration/clientes-historial.test.ts` | Cumple |
| RF-02, RB-03: cotización de catálogo y personalizada; total igual a la suma | `src/core/costeo.ts`; restricción `cotizacion_aritmetica`; `tests/integration/costeo-paridad-bd.test.ts` | Cumple |
| RF-03, RF-04, RB-04, RB-05 (Figura H4): orden solo desde cotización aprobada, sin redigitar | `src/modules/ordenes/conversion.ts`; trigger `trg_orden_exige_aprobada`; `tests/integration/ordenes-conversion.test.ts` | Cumple (ver diferencia sobre «orden activa» en la sección 3) |
| RF-05, RF-06, RB-06, RB-07 (Figura H5): existencias y consumo ligado a orden, sin saldo negativo | `src/modules/inventario/consumo.ts`; `material_existencia_no_negativa`; `tests/integration/inventario-concurrencia.test.ts` | Cumple |
| RF-07, RB-08 (Figura H6): etapa con responsable y fecha-hora | `src/modules/produccion/etapas.ts`; tabla `historial_etapa`; `tests/integration/produccion-historial.test.ts` | Cumple |
| RF-08, RB-09: historial cronológico sin sobrescritura | triggers `trg_bitacora_solo_insercion` y `trg_historial_etapa_solo_insercion`; `tests/integration/errores-bd.test.ts` | Cumple |
| RF-09 (Tabla 17): panel con cotizaciones, materiales y carga | `src/modules/panel/consultas.ts`; `tests/integration/panel-consulta.test.ts` | Cumple (el formato difiere, ver sección 3) |
| RF-10, RB-10, RNF-03: permisos por rol, evaluados en servidor | `src/core/permisos.ts`; `src/lib/http.ts`; `tests/unit/permisos.test.ts` | Cumple |
| 4.5 Tabla 14: matriz de operaciones por área | `src/core/permisos.ts` (consumir solo ADM; inventario:ver GER, ADM, OPE; planificar OPE y ADM; ejecutar PRO y ADM; responder OPE y ATC) | Cumple |
| 1.7 y 4.1: cinco perfiles más administración técnica | enum `CodigoPerfil` con 6 valores en `prisma/schema.prisma`; ADR-014 | Cumple |
| RNF-01: 95 % en 2 s con 20 sesiones | `scripts/rendimiento.mjs`; `docs/pruebas/resultado-rendimiento.json` (p95 118,65 ms) | Cumple |
| RNF-02: rechazo sin sesión válida | `src/lib/http.ts` (`manejar`); `tests/integration/auth-http.test.ts` | Cumple |
| RNF-04: HTTPS con TLS 1.2 o superior | `infra/Caddyfile`; `scripts/verificar-tls.mjs`; `docs/pruebas/tls.md` | Cumple con el perfil `proxy` (ver sección 3) |
| RNF-05: cero duplicados, huérfanos y saldos negativos | `tests/integration/errores-bd.test.ts`; `scripts/prueba-recuperacion.sh` | Cumple |
| RNF-06, RNF-07: respaldo cada 24 h y restauración en 4 h | `scripts/respaldo-programado.sh`; servicio `respaldo` en `compose.yaml`; `docs/pruebas/respaldo-RNF-06-07.md` | Cumple |
| RNF-08: flujos en 768, 1024, 1366 y 1920 px | `e2e/superposicion.spec.ts` (24 pruebas, seis perfiles) | Cumple |
| 4.6: importes con NUMERIC; operaciones críticas en transacción | tipos `Decimal` en `prisma/schema.prisma`; `fn_movimiento_aplicar` en `prisma/sql/restricciones.sql` | Cumple |
| 4.6 y Anexo G: idempotencia en consumo | `src/modules/inventario/idempotencia.ts`; `tests/integration/inventario-idempotencia.test.ts` | Cumple |
| 4.8 Tabla 18: bitácora de cambios de permisos e intentos de acceso | acciones `OTORGAR_PERMISO`, `REVOCAR_PERMISO`, `INICIO_SESION_FALLIDO` en `prisma/schema.prisma` | Cumple |
| 4.10: Compose, migraciones, CI y datos ficticios con importación piloto | `compose.yaml`; `.github/workflows/ci.yml`; `prisma/seed/`; `src/modules/importacion/` | Cumple |

## 3. La tesis difiere del sistema

Corrige estas filas en el documento la semana siguiente.

| Tesis (sección y texto resumido) | Valor real en el sistema | Archivo de evidencia |
|---|---|---|
| 4.6 y Anexo G: el modelo tiene 17 tablas en 4 dominios | 26 modelos. 17 equivalen a las tablas de la tesis. 9 son extras: `categoria`, `area`, `receta_producto`, `consumo_estimado`, `linea_costo`, `etapa_plantilla`, `configuracion`, `solicitud_idempotente`, `contador` | `prisma/schema.prisma` (26 líneas `model`) |
| Anexo G (G1 a G17): nombres `usuarios`, `roles`, `rol_permisos`, `usuario_roles`, `sesiones`, `bitacora_eventos`, `catalogo_conceptos`, `cotizacion_detalles`, `odt_etapas_produccion`, `odt_etapas_historial`, `odt_consumos_material` | Nombres en singular y con otros términos: `usuario`, `perfil`, `perfil_permiso`, `usuario_perfil`, `sesion`, `bitacora`, `producto`, `item_cotizacion` con `linea_costo`, `etapa_orden`, `historial_etapa`, `consumo_orden` | `prisma/schema.prisma` (`@@map`) |
| Tabla 16 y Anexo G: claves `id_*` y `bigserial` | Todas las claves son UUID con `gen_random_uuid()`. Las tablas puente usan clave compuesta. `contador` usa (tipo, anio) | `prisma/schema.prisma`; `docs/capitulo-iv/ajuste-v9-stack.md` sección 4 |
| Tabla G12: la orden nace en estado `REGISTRADA` | 6 estados: PENDIENTE, EN_PRODUCCION, LISTA, ENTREGADA, CERRADA, CANCELADA. El defecto es PENDIENTE | `prisma/schema.prisma` (`EstadoOrden`); `docs/capitulo-iv/ajuste-v9-stack.md` sección 3 |
| Tabla G9: la cotización tiene `estado` con defecto BORRADOR y campos de aprobación | 6 estados: BORRADOR, ENVIADA, APROBADA, RECHAZADA, VENCIDA, AJUSTE_SOLICITADO. La fecha de aprobación se guarda en `fechaRespuesta`. La referencia admite 200 caracteres (la tesis dice 300) | `prisma/schema.prisma` (`EstadoCotizacion`, `Cotizacion`) |
| Figuras 5 y 6: orden de ejemplo `ODT-0001`; Tabla G12: `codigo_odt` | Numeración `OT-AAAA-NNNN` en órdenes y `COT-AAAA-NNNN` en cotizaciones. La columna se llama `numero` | `prisma/sql/restricciones.sql` (`siguiente_numero`, líneas 741 a 759) |
| Tabla G1 y G6: usuario con `username`; token de sesión `varchar(128)` | El usuario inicia con `correo`. Tiene `intentos_fallidos`, `bloqueado_hasta` y `contrasena_temporal`. El token guarda SHA-256 en `char(64)` y la sesión tiene `revocada_en` | `prisma/schema.prisma` (`Usuario`, `Sesion`) |
| Tabla G7: `bitacora_eventos` con `entidad` y `operacion` en texto y `datos_json` | `bitacora` con enums `EntidadBitacora` y `AccionBitacora`, columna `detalle` JSON y llaves `orden_id` y `cotizacion_id` | `prisma/schema.prisma` (`Bitacora`) |
| Tabla G14: `odt_etapas_historial` con `etapa_produccion_id`, fechas de inicio y fin | `historial_etapa` con `estado_anterior`, `estado_nuevo`, `responsable_id`, `usuario_id` y `creado_en` | `prisma/schema.prisma` (`HistorialEtapa`) |
| Tablas G15, G16 y G17: `numeric(18,4)`; `idempotency_key` `varchar(128)` en movimientos y `varchar(120)` en consumos | `existencia` y `stock_minimo` son `numeric(14,3)`; costos `numeric(14,4)`; importes `numeric(14,2)`. La clave de idempotencia es UUID y está en `consumo_orden` y en `solicitud_idempotente`, no en el movimiento | `prisma/schema.prisma` (`Material`, `ConsumoOrden`, `SolicitudIdempotente`) |
| Tabla 16 y RB-05: máximo una orden activa por cotización de origen | Una sola orden por cotización, también si se cancela. La reapertura usa una versión corregida | `prisma/schema.prisma` (`cotizacionId @unique`); `docs/capitulo-iv/ajuste-v9-stack.md` sección 5 |
| 4.9, Tablas 19 y 20, lámina 13: React, TypeScript, Vite, NestJS, TypeORM, Docker Compose | Next.js 16.3.8, React 19.3.0, Prisma 7.10.0, PostgreSQL 17, Tailwind 4, shadcn/ui, Node 24, pnpm 11 y Docker Compose | `package.json`; `docs/tecnologias.md`; `docs/decisiones.md` (ADR-001 y ADR-002) |
| Referencias: «PostgreSQL 18 documentation». El cuerpo no cita versión | PostgreSQL 17 en `postgres:17-alpine` y en el servicio de CI | `compose.yaml`; `.github/workflows/ci.yml` |
| 4.4, Tabla 12 y Figura 1: tres contenedores (interfaz, API, base de datos) | Una aplicación Next.js sirve interfaz y API (`/api/v1`). Hay además `db`, `db_test`, `migrate`, `respaldo` y `proxy` opcional | `compose.yaml`; `docs/arquitectura-sistema.md` sección 1 |
| 4.10: el repositorio separa frontend, backend, migraciones y «documentación de instalación» | Un solo proyecto (`src/app`, `src/modules`, `src/core`, `src/lib`, `prisma/`). La instalación se explica solo en la sección «Arranque» del README | `README.md`; `docs/arquitectura-sistema.md` sección 2 |
| RNF-04: el 100 % de las conexiones usa HTTPS | `docker compose up` abre `http://127.0.0.1:3000`. HTTPS exige `--profile proxy` (Caddy, `tracore.localhost:8443`, certificado interno) | `compose.yaml`; `infra/Caddyfile`; `docs/pruebas/tls.md` |
| 4.11 y Tabla 21: es un plan y no presenta resultados; menciona «Capítulo V» (3.8, Anexo H) | Hay resultados: 28 de 28 criterios cubiertos, p95 118,65 ms, restauración probada. El índice de la tesis no tiene Capítulo V | `docs/trazabilidad.md`; `docs/pruebas/`; `docs/capitulo-iv/4-11-evidencias-calidad.md` |
| 4.7, Figuras 3 a 6, Anexo I y lámina 14: prototipo visual, «Backend por verificar» | Sistema con servidor, base de datos, 71 rutas API y capturas reales | `docs/arquitectura-sistema.md` sección 2; `docs/capturas/` |
| 4.7.3, Tabla 17 y RF-09: un panel con cotizaciones pendientes, materiales y carga, para Gerencia, Administración y Operaciones | Un panel distinto por perfil: cuatro indicadores, un gráfico y la lista «Requiere atención». Lo ven 5 perfiles (todos menos ADMIN). Un usuario con varios perfiles usa un selector | `docs/modulos/11-cambios-ui-v9.md`; `src/core/permisos.ts` (`panel:ver`) |
| 4.7.2: menú lateral con panel, clientes, cotizaciones, órdenes, inventario, producción, trazabilidad y administración | Además hay catálogo, importar y reportes. El menú es un riel de íconos que se expande | `src/app/(app)/`; `src/components/layout/AppShell.tsx` |
| 4.5, Tabla 14: el perfil técnico se limita a usuarios y permisos | ADMIN gestiona usuarios, permisos y configuración, y consulta la bitácora. Gerencia también consulta la bitácora | `docs/arquitectura-sistema.md` sección 7; `src/core/permisos.ts` |
| 4.13, Tabla 23 y Figura 7: base técnica del 12 al 23 de octubre; módulos del 19 de octubre al 20 de noviembre; pruebas del 16 al 26 de noviembre | El primer commit es del 2026-10-05. Al 2026-10-13 hay 72 commits, los módulos completos, la matriz de pruebas y las auditorías | `git log` del repositorio; `docs/trazabilidad.md`; `docs/auditoria/` |
| 4.13: tres sprints de Scrum y matriz requisito-historia-tarea | No consta backlog ni sprints en el repositorio. Existe la matriz requisito-prueba | `docs/trazabilidad.md` |
| Nombre: TRACORE en todo el documento | La interfaz dice TRACORE. El paquete, la base, el rol y la cookie usan `sc-plataforma`, `sc_app`, `sc_sesion`. `docs/arquitectura-sistema.md` titula «SC Plataforma» | `src/core/marca.ts`; `package.json`; `.env.example` |
| Figura I10: panel a 375 px en modo oscuro | El sistema solo tiene tema claro | `docs/tecnologias.md` (next-themes descartada); `src/app/globals.css` sin reglas dark |

## 4. El sistema tiene y la tesis no menciona

Cada fila se verificó en el repositorio.

| Función extra | Archivo de evidencia |
|---|---|
| Bloqueo a 5 intentos por 15 minutos (423) | `src/modules/auth/service.ts` (`INTENTOS_MAXIMOS = 5`); `docs/seguridad.md` |
| Clave temporal que caduca (48 h) y obliga a cambiarla | `src/modules/admin/service.ts` línea 64; `src/modules/auth/service.ts` (`claveTemporalVencida`); `prisma/schema.prisma` |
| Contraseñas con argon2id, mínimo 14 caracteres | `src/lib/auth/password.ts`; `src/modules/auth/schema.ts` línea 24 |
| CSP obligatoria y cabeceras de seguridad | `next.config.ts`; ADR-016 |
| Verificación de origen en POST, PUT, PATCH y DELETE | `src/lib/http.ts` (`origenPermitido`) |
| Idempotencia de escrituras de inventario por UUID | `src/modules/inventario/idempotencia.ts`; modelo `SolicitudIdempotente` |
| Control de versión por fila en la edición de órdenes | `src/modules/ordenes/repo.ts` líneas 73 a 89; `src/modules/ordenes/schema.ts` |
| Versión corregida y duplicado de cotización | `src/modules/cotizaciones/service.ts` (`duplicarCotizacion`, `crearVersionCorregida`); columna `version` |
| Estado AJUSTE_SOLICITADO y referencia de aprobación | `prisma/schema.prisma` (`EstadoCotizacion`, `referenciaAprobacion`) |
| Plantillas de etapas por categoría y recetas por producto | modelos `EtapaPlantilla` y `RecetaProducto` en `prisma/schema.prisma`; `src/modules/catalogo/` |
| Consumo estimado por orden | modelo `ConsumoEstimado`; `src/core/consumo-estimado.ts` |
| Varios perfiles por usuario con permisos en unión | modelo `UsuarioPerfil`; ADR-014 |
| Matriz de permisos editable desde la interfaz | `src/modules/admin/permisos-service.ts`; `src/modules/admin/componentes/MatrizPermisos.tsx` |
| Configuración (IVA, vigencia, moneda, tipo de cambio) | `src/modules/admin/configuracion-service.ts`; modelo `Configuracion` |
| Exportación CSV y XLSX de reportes | `src/modules/reportes/csv.ts`; `src/modules/reportes/xlsx.ts`; `src/app/api/v1/reportes/[nombre]/route.ts` |
| Importación CSV de clientes y materiales con validación en seco | `src/modules/importacion/`; `tests/integration/importacion-servicio.test.ts`; ADR-019 |
| Dos monedas (NIO y USD) con tipo de cambio congelado | columnas `moneda` y `tipoCambio` en `Cotizacion`; ADR-018; `e2e/cotizaciones-usd.spec.ts` |
| Confirmación de consumo antes de enviar | `src/modules/inventario/componentes/ConfirmarConsumo.tsx`; ADR-019 |
| HTTPS con TLS 1.2 o superior y HSTS (proxy opcional) | `infra/Caddyfile`; `scripts/verificar-tls.mjs`; `docs/pruebas/tls.md` |
| Límite de tasa con respuesta 429 y `Retry-After` | `src/lib/limite-tasa.ts`; `tests/integration/limite-tasa.test.ts`; ADR-017 |
| Bitácora de accesos (inicio, fallo, bloqueo, cierre, cambio de clave) | `prisma/schema.prisma` (`AccionBitacora`); `src/modules/auth/service.ts` |
| Respaldo programado cada 23 h con registro y verificación | `scripts/respaldo-programado.sh`; servicio `respaldo` en `compose.yaml` |
| Cifrado AES-256-GCM de la copia externa del respaldo (paso manual) | `scripts/respaldo/cifrado.mjs`; `scripts/respaldo/externo.mjs`; `docs/operacion/respaldo-externo.md`; `tests/unit/respaldo-cifrado.test.ts` |
| CI de GitHub Actions (verificación, auditoría y E2E) | `.github/workflows/ci.yml`; `.github/workflows/auditoria.yml`; `.github/workflows/e2e.yml`; `scripts/ci-local.mjs` |
| Auditorías técnicas (14 informes, ISO 25010) | `docs/auditoria/` |
| Regresión visual | `e2e/regresion-visual.spec.ts` |
| Proforma imprimible | `src/modules/cotizaciones/componentes/ImprimirProforma.tsx` |
| Redacción de secretos en registros y validación de entorno | `src/lib/registro.ts`; `src/env.ts`; `docs/tecnologias.md` |
| Reversión versionada de migraciones | `prisma/migrations-down/`; `docs/pruebas/reversion.md` |

## 5. Brechas que quedan

| Lo que pide la tesis | Estado en el sistema | Evidencia |
|---|---|---|
| Figura I10 y Anexo I: modo oscuro a 375 px | Pendiente por decisión de Norman. El trabajo hecho está guardado en la bóveda (`wiki/projects/sc-plataforma/modo-oscuro-pendiente`) | `docs/tecnologias.md`; `src/app/globals.css` |
| 4.12 y 4.13: «manual operativo por perfil» y «manuales» como entregable | No consta en `docs/` ni en el README | búsqueda de «manual» en `docs/`, `README.md`, `AGENTS.md` |
| 4.10 y 4.12: «guía de instalación» | Parcial. Solo la sección «Arranque» del README y `docs/despliegue-https.md` | `README.md`; `docs/despliegue-https.md` |
| Tabla 17: «recuperación de sesión según política» en la pantalla de acceso | Parcial. No hay recuperación autoservicio. Existen cambio de clave y clave temporal entregada por ADMIN | `src/modules/auth/schema.ts`; `src/modules/admin/service.ts` |
| Tabla 18: «criterios de conservación y eliminación» de datos personales, con política documentada | No consta. Solo hay retención de 7 días para respaldos | `docs/pruebas/respaldo-RNF-06-07.md` |
| RNF-06 y 4.8: respaldo con copia segura | Parcial. El respaldo programado no cifra y vive en el mismo equipo. La copia cifrada es un paso manual | `scripts/respaldo-programado.sh`; `docs/operacion/respaldo-externo.md`; ADR-015 |
| RNF-04: HTTPS en el entorno de operación | Parcial. El arranque por defecto es HTTP. El certificado del proxy es interno | `compose.yaml`; `docs/pruebas/tls.md` |
| 4.10: migración desde hojas de cálculo y el sistema de órdenes actual | Parcial. La importación CSV cubre clientes y materiales. No cubre cotizaciones ni órdenes | `src/modules/importacion/`; ADR-019 |
| RNF-03: ningún dato cambia en casos no autorizados | Parcial. La comprobación de no modificación existe en órdenes y cotizaciones. Falta en clientes, inventario, producción y catálogo | `docs/trazabilidad.md` (brecha 5) |
| RB-02: toda cotización tiene cliente válido | Parcial. Falta la prueba de inserción directa sin cliente | `docs/trazabilidad.md` (brecha 6) |
| OE4 y Anexo D: validación con cinco usuarios y juicio de expertos | No consta ejecución en el repositorio | sin archivo |
| 4.13: matriz requisito-historia-tarea y sprints Scrum | Parcial. Existe la matriz requisito-prueba. No consta backlog | `docs/trazabilidad.md` |
| Tabla 17: «consultas exportables si se justifican» | Cubierto con CSV y XLSX solo para Gerencia (`reporte:exportar`) | `src/core/permisos.ts` |

## 6. No se pudo verificar

- Las figuras de la tesis (1 a 7, H1 a H7, I1 a I11) son imágenes. Solo leí el texto y las notas.
- No leí el ERD de la Figura H7. No comparé sus cardinalidades con `prisma/schema.prisma`.
- No ejecuté el sistema ni las pruebas. Las cifras vienen de `docs/`.
- No recontamé las 2 580 pruebas unitarias y de integración, las 829 E2E ni las 10 de regresión visual de `docs/capitulo-iv/4-11-evidencias-calidad.md`.
- Conté archivos: 76 de integración, 71 unitarios y 19 E2E.
- No revisé a detalle los Anexos B, C, E y F de la tesis. No afectan este contraste.
- La tesis no cita versión de PostgreSQL en el cuerpo. Solo la referencia nombra «PostgreSQL 18 documentation».
- No hallé el Capítulo V que citan 3.8 y la nota del Anexo H. El índice solo tiene cuatro capítulos.
- No consta en el repositorio la ejecución de Scrum, del juicio de expertos ni de la validación con usuarios.
- `docs/trazabilidad.md` cita `e2e/tema.spec.ts` en RNF-08. Ese archivo no existe en `e2e/`.

Incoherencias en documentos del sistema (corregidas el 2026-10-13, salvo las marcadas como abiertas):

- `docs/trazabilidad.md` dice que los códigos CF son de la tesis v6. La v9.4 conserva CF-01 a CF-11 en el Anexo D y en la Tabla 2.
- `AGENTS.md` y `docs/seguridad.md` citan CF-01 a CF-11, pero la matriz usa RF, RNF y RB.
- `docs/capitulo-iv/4-11-evidencias-calidad.md` dice 26 cubiertos y 2 parciales. `docs/trazabilidad.md` dice 28 cubiertos.
- El mismo documento 4-11 dice «ausencia de límites de CPU y memoria». ADR-015 los fija el 2026-10-13.
- `docs/seguridad.md` marca como pendiente la longitud mínima de 8 caracteres. El código exige 14 (`src/modules/auth/schema.ts` línea 24).
- `docs/seguridad.md` y `docs/arquitectura-sistema.md` dicen que no hay límite de tasa. ADR-017 lo agregó.
- `docs/modulos/08-panel-reportes.md` describe los bloques anteriores del panel. `docs/modulos/11-cambios-ui-v9.md` los reemplaza.
- `docs/pruebas/respaldo-RNF-06-07.md` dice 24 h por defecto. El README y `scripts/respaldo-programado.sh` usan 23 h.
- El tiempo de restauración aparece como 2 s en `docs/trazabilidad.md` y 3 s en `docs/capitulo-iv/4-11-evidencias-calidad.md`.

Estado de corrección:
- Corregidas: cifras de pruebas y requisitos en 4-11 (28 cubiertos), límites de CPU y memoria, longitud mínima de contraseña (14), límite de tasa en seguridad y arquitectura, intervalo de respaldo (23 h), tiempo de restauración (2 s) y la cita a `e2e/tema.spec.ts`.
- Abiertas: códigos CF frente a RF, RNF y RB en AGENTS.md y seguridad.md; descripción del panel en `docs/modulos/08-panel-reportes.md`; los conteos de pruebas de 4-11 (2 580, 829) se actualizan al cerrar la corrida final.
