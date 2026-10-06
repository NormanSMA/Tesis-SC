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
| ADR-006 | 2026-10-05 | Ajustes de inventario solo para Gerencia | Control. Producción cuenta, Gerencia ajusta | Producción ajusta |
| ADR-007 | 2026-10-05 | Commits sin Co-Authored-By. Sin push sin aprobación | Decisión del usuario, igual que en TURNO | Coautoría de Claude |
| ADR-008 | 2026-10-05 | OmniRoute omitido en este proyecto | Exige API key ausente del entorno. Haiku cubre las tareas masivas | Configurar la clave |
| ADR-009 | 2026-10-05 | La aplicación se conecta con un rol que no es dueño de las tablas | Los triggers no protegen contra el dueño | Un solo rol |
| ADR-010 | 2026-10-05 | Node 24 en Docker | Prisma 7.10 no soporta Node 26 | Node 26 |
| ADR-011 | 2026-10-06 | Los documentos asociados muestran siempre los datos actuales del cliente, sin copia histórica | Sistema no fiscal. Las cotizaciones ya congelan montos. Costo: una proforma impresa más tarde muestra el nombre vigente | Copia de nombre y RUC en cada cotización |
| ADR-012 | 2026-10-06 | Migración cliente_checks: teléfono y correo no vacíos y correo en minúsculas | La base aceptaba teléfono vacío y correo en mayúsculas. Hallazgo de Codex y Gemini | Validar solo en el servicio |
| ADR-013 | 2026-10-06 | Auditoría de diseño con dos proveedores distintos antes de programar cada módulo | Regla del usuario. Cada hallazgo se verifica en el código. Se rechazan los que sobreingenian | Un solo auditor |
