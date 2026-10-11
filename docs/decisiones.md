# Registro de decisiones

Formato: ID, fecha, decisión, razón, alternativas descartadas.
Material para el Capítulo IV.

| ID | Fecha | Decisión | Razón | Descartado |
|---|---|---|---|---|
| ADR-001 | 2026-10-05 | Stack: Next.js 16, Prisma 7.10.0, PostgreSQL 17, Tailwind 4, shadcn/ui, Docker Compose | Un repositorio, un contenedor, experiencia previa, plazo. Ver docs/capitulo-iv/comparacion-stack.md | NestJS con React, Django con HTMX, Laravel con Filament |
| ADR-002 | 2026-10-05 | Prisma fijo en 7.10.0 | La etiqueta latest de npm es 8.0.0-rc.20 | Versión candidata |
| ADR-003 | 2026-10-05 | Modelo de datos con reglas en PostgreSQL: CHECK, triggers y transiciones | La integridad no depende del código de la aplicación. Ver docs/analisis/05-modelo-datos.md | Reglas solo en el servicio |
| ADR-004 | 2026-10-05 | Margen sobre precio de venta, por ítem personalizado | Decisión del usuario. Mantiene el porcentaje entre 0 y 100 | Recargo sobre costo |
| ADR-005 | 2026-10-05 | Fechas de calendario en date. Instantes en timestamptz. Costo unitario con cuatro decimales | Evita el desfase de un día en Managua y el error de redondeo del promedio | timestamptz para todo, dos decimales |
| ADR-006 | 2026-10-05 | Reemplazada por ADR-014: los ajustes de inventario corresponden a Administración | Conservar el antecedente; aplicar la matriz v9 | La concesión anterior a Gerencia |
| ADR-007 | 2026-10-05 | Commits sin Co-Authored-By. Sin push sin aprobación | Decisión del usuario, igual que en TURNO | Coautoría de Claude |
| ADR-008 | 2026-10-05 | OmniRoute omitido en este proyecto | Exige API key ausente del entorno. Haiku cubre las tareas masivas | Configurar la clave |
| ADR-009 | 2026-10-05 | La aplicación se conecta con un rol que no es dueño de las tablas | Los triggers no protegen contra el dueño | Un solo rol |
| ADR-010 | 2026-10-05 | Node 24 en Docker | Prisma 7.10 no soporta Node 26 | Node 26 |
| ADR-011 | 2026-10-06 | Los documentos asociados muestran siempre los datos actuales del cliente, sin copia histórica | Sistema no fiscal. Las cotizaciones ya congelan montos. Costo: una proforma impresa más tarde muestra el nombre vigente | Copia de nombre y RUC en cada cotización |
| ADR-012 | 2026-10-06 | Migración cliente_checks: teléfono y correo no vacíos y correo en minúsculas | La base aceptaba teléfono vacío y correo en mayúsculas. Hallazgo de Codex y Gemini | Validar solo en el servicio |
| ADR-013 | 2026-10-06 | Auditoría de diseño con dos proveedores distintos antes de programar cada módulo | Regla del usuario. Cada hallazgo se verifica en el código. Se rechazan los que sobreingenian | Un solo auditor |
| ADR-014 | 2026-10-10 | Seis perfiles, varios perfiles por usuario y migración mediante expansión y contracción | Aplicar la tesis v9 y conservar los datos | Perfil único y matriz anterior |

## ADR-014: perfiles v9 y migraciones de datos

Estado de origen: propuesto por el arquitecto; aprobación de Norman pendiente.
Documente la implementación vigente sin interpretar su presencia como aprobación.
Consulte la matriz en [09-perfiles-v9.md](modulos/09-perfiles-v9.md).
Verifique su implementación en `src/core/permisos.ts`.

- Use GERENCIA, ADMINISTRACION, OPERACIONES, ATENCION_CLIENTE, PRODUCCION y ADMIN.
- Renombre VENTAS a ATENCION_CLIENTE conservando el UUID del perfil.
- Distinga ADMIN, Administración técnica, de ADMINISTRACION, Administración.
- Asigne varios perfiles mediante `usuario_perfil`; una sus permisos efectivos.
- Conserve `can()`; sustituya `actor.perfil` por `actor.perfiles`.
- Restrinja Gerencia a consulta y exportación de reportes.
- Reserve ajustes, entradas, consumos y gestión de materiales para Administración.
- Reserve gestión de catálogo y creación y cancelación de órdenes para Operaciones.
- Permita aprobación comercial a Operaciones y Atención al cliente.
- Permita entrega y cierre a Operaciones y Atención al cliente.
- Permita planificación a Operaciones y Administración; ejecución a Producción y Administración.
- Restrinja ADMIN a usuarios, permisos, configuración y consulta de bitácora.

Conserve el orden de migración propuesto:

| Paso | Cambio |
|---|---|
| M1 | Amplíe enums; renombre VENTAS; agregue AJUSTE_SOLICITADO. |
| M2 | Cree `usuario_perfil`, rellene relaciones y retire concesiones anteriores. |
| M3 | Agregue código único del cliente y costo unitario del producto. |
| M4 | Registre aprobador, referencia obligatoria, versión y motivo de ajuste de cotización. |
| M5 | Vincule cliente con cotización; permita responsable nulo en órdenes. |
| M6 | Registre cantidad, costo e idempotencia en `consumo_orden`. |
| M7 | Cree `historial_etapa` de solo inserción y rellene desde bitácora. |
| M8 | Retire `usuario.perfil_id` después del relleno. |

Conserve una orden por cotización mediante `cotizacion_id` único.
Cree una versión corregida desde AJUSTE_SOLICITADO mediante la lógica de duplicación.
Mantenga los scripts de reversión en `prisma/migrations-down/`.
Revise permisos persistentes, responsables nulos y aprobaciones antiguas durante las migraciones.

Reemplace ADR-006 y SD-24 donde contradigan la matriz v9.
Mantenga revisables los repartos por defecto indicados en el documento de perfiles.
