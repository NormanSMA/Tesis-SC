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
| ADR-015 | 2026-10-12 | Riesgos aceptados tras la auditoría (ver sección ADR-015) | Auditoría de backend, DevOps y frontend con evidencia en docs/auditoria. Cada riesgo tiene su razón de no corregirse hoy | Corregirlos antes de la defensa |
| ADR-016 | 2026-10-12 | CSP obligatoria con `'unsafe-inline'` en scripts y estilos; zod sin JIT en el cliente; PostgreSQL con `jit=off`; imágenes base fijadas por digest | ZAP, Lighthouse y la prueba de volumen. Next inyecta scripts en línea; sin `unsafe-eval`, zod no puede sondear `new Function` | CSP con nonce (obliga a renderizado dinámico en todas las páginas) |

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

## ADR-015: riesgos aceptados tras la auditoría (2026-10-12)
Cada punto cita el informe de `docs/auditoria/`. Se revisan al terminar la tesis o ante un cambio de alcance.
- Bloqueo de cuenta con 423 y credenciales con 401: informa al usuario legítimo del bloqueo. Aceptado en la auditoría de seguridad del 2026-10-11.
- Verificación de origen por el encabezado `host` (`src/lib/http.ts:25`): válido en el despliegue local de una sola empresa. Detrás de un proxy, fijar `Host` y TLS en el proxy.
- Vulnerabilidades transitivas sin acceso desde la aplicación (2-8, 3-devops): `mysql2` y `deepmerge-ts` (CLI de Prisma), `uuid` (exceljs solo llama `uuidv4()` sin búfer), `braces` (solo desarrollo), y las de la imagen Debian y de dependencias de exceljs (`tar`, `undici`, `ip-address`, `brace-expansion`). No se actualiza Prisma ni Next antes de la defensa. `pnpm audit --prod --audit-level=critical` bloquea los CRITICAL nuevos.
- Costo de línea de material en cotizaciones (`cotizaciones/costear.ts:85`, 2-7): resuelto el 2026-10-12. Con material registrado el servidor fija el costo (el guardado si la línea ya existe, o el promedio vigente) y la pantalla muestra el campo de solo lectura. El costo libre queda solo en líneas sin material (compras especiales), validado por rango y precisión y registrado en bitácora. Prueba: `tests/integration/cotizaciones-costo-material.test.ts`.
- `cotizacion:responder` sin `cotizacion:ver` devuelve dinero en la respuesta (2-6): solo ocurre si Administración edita la matriz por defecto. Se acepta.
- Reportes sin presupuesto de filas, DTO completos hacia acciones de ficha, claves de índice en listas de solo lectura, comparación y meta en los indicadores de cuatro paneles (2-7, 4-frontend): P3 sin impacto a la escala de la empresa.
- Respaldos en el mismo equipo que la base, sin cifrado y con intervalo de 24 h más la duración (3-devops): copia externa y cifrado son tareas operativas de Norman al desplegar.
- Límites de CPU y memoria sin fijar en `compose.yaml`: sin medición de carga real.
- Índices sin uso (55 en la demostración): no se borran; la medición de uso depende del tráfico.
- `Content-Type` no verificado en el cuerpo JSON: la verificación de origen cubre CSRF.

## ADR-016: endurecimiento de cabeceras, JIT y base de imágenes (2026-10-12)
- `next.config.ts`: la política `Content-Security-Policy` pasa de `Report-Only` a obligatoria, con `object-src 'none'`. Mantiene `'unsafe-inline'` en `script-src` y `style-src` porque Next inyecta scripts en línea. No se usa nonce: obligaría a renderizado dinámico en todas las páginas.
- `src/instrumentation-client.ts` fija `z.config({ jitless: true })`: sin `unsafe-eval`, zod 4 no sondea `new Function` y el navegador no registra violaciones.
- `compose.yaml`: PostgreSQL con `-c jit=off`. Con 40 000 cotizaciones el panel comercial pasaba de 266 ms a 2013 ms por JIT.
- `Dockerfile` y `compose.yaml`: `node:24-bookworm-slim` y `postgres:17-alpine` fijadas por digest. La etapa final aplica `apt-get upgrade` para tomar las correcciones de Debian publicadas.
- Los formularios de login y de cambio de clave declaran `method="post"`: sin JavaScript hidratado no envían la contraseña por GET.
- Cuerpo JSON limitado a 1 000 000 de bytes (413) y decimales a 64 caracteres.
