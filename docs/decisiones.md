# Registro de decisiones

Formato: ID, fecha, decisión, razón, alternativas descartadas.
Material para el Capítulo IV.

| ID | Fecha | Decisión | Razón | Descartado |
|---|---|---|---|---|
| ADR-001 | 2026-10-05 | Stack: Next.js 16, Prisma 7.10.0, PostgreSQL 17, Tailwind 4, shadcn/ui, Docker Compose | Un repositorio, un contenedor, experiencia previa, plazo. La comparación completa está en el capítulo IV de la tesis | NestJS con React, Django con HTMX, Laravel con Filament |
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
| ADR-017 | 2026-10-13 | Límite de tasa en memoria, proxy HTTPS con Caddy y bitácora de accesos | Cierra RNF-04 y la bitácora de seguridad de la tesis 4.8 sin cambiar URL de E2E, CI ni RNF-01. Diseño del agente arquitecto | Límite en Caddy (plugin propio), límite en proxy.ts de Next, usuario falso de sistema para fallos |
| ADR-018 | 2026-10-13 | Dos monedas (NIO y USD) por cotización con tipo de cambio congelado | Norman pidió manejar córdobas y dólares. Cada cotización guarda sus montos en su moneda; el motor de costeo no cambia | Montos siempre en NIO con conversión al mostrar; moneda por ítem |
| ADR-019 | 2026-10-13 | Confirmación de consumo y importación CSV por fila | La tesis enfatiza «Confirmar consumo» (predefensa lámina 11) y la importación piloto (4.10). La importación valida en seco y crea fila por fila con bitácora | Una sola transacción para todo el archivo; tocar los servicios de alta |
| ADR-020 | 2026-10-13 | Diferir la migración de la autenticación a Better Auth hasta validar el piloto | Cubre de forma nativa 5 de 15 requisitos propios (bloqueo, clave temporal, matriz de perfiles, bitácora con IP truncada y cookie Secure por solicitud siguen propios). No mejora la seguridad actual y toca el login cerca de la predefensa | Migrar ahora (30 a 40 h, riesgo alto); spike inmediato (18 h) |
| ADR-021 | 2026-10-14 | Descuento comercial por porcentaje o monto; cantidades sin ceros sobrantes; costos con 2 decimales | Pedido de Norman: escribir el descuento en porcentaje y verlo en moneda; números más legibles | Guardar solo el porcentaje; redondear unidades discretas |

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
- Respaldos en el mismo equipo que la base, sin cifrado y con intervalo de 23 h (3-devops): copia externa y cifrado son tareas operativas de Norman al desplegar.
- Límites de CPU y memoria: fijados el 2026-10-13 en `compose.yaml` (app y migración 1 g y 2 CPU; respaldo 256 m; proxy 128 m). Revisar con carga real de producción.
- Índices sin uso (55 en la demostración): no se borran; la medición de uso depende del tráfico.
- `Content-Type` no verificado en el cuerpo JSON: la verificación de origen cubre CSRF.

## ADR-016: endurecimiento de cabeceras, JIT y base de imágenes (2026-10-12)
- `next.config.ts`: la política `Content-Security-Policy` pasa de `Report-Only` a obligatoria, con `object-src 'none'`. Mantiene `'unsafe-inline'` en `script-src` y `style-src` porque Next inyecta scripts en línea. No se usa nonce: obligaría a renderizado dinámico en todas las páginas.
- `src/instrumentation-client.ts` fija `z.config({ jitless: true })`: sin `unsafe-eval`, zod 4 no sondea `new Function` y el navegador no registra violaciones.
- `compose.yaml`: PostgreSQL con `-c jit=off`. Con 40 000 cotizaciones el panel comercial pasaba de 266 ms a 2013 ms por JIT.
- `Dockerfile` y `compose.yaml`: `node:24-bookworm-slim` y `postgres:17-alpine` fijadas por digest. La etapa final aplica `apt-get upgrade` para tomar las correcciones de Debian publicadas.
- Los formularios de login y de cambio de clave declaran `method="post"`: sin JavaScript hidratado no envían la contraseña por GET.
- Cuerpo JSON limitado a 1 000 000 de bytes (413) y decimales a 64 caracteres.

## ADR-017: límite de tasa, proxy HTTPS y bitácora de accesos (2026-10-13)
Límite de tasa (`src/lib/limite-tasa.ts`, `rate-limiter-flexible` en memoria, una sola instancia):
- `usuario:lectura` 6000 por 60 s (GET, HEAD); `usuario:escritura` 1200 por 60 s; `ip:publica` 120 por 60 s (login y logout); `ip:login-fallo` 30 por 900 s (solo 401 o 423).
- Márgenes frente a RNF-01 (unas 1300 operaciones por usuario y minuto). `scripts/rendimiento.mjs` cuenta cualquier 429 como NO CUMPLE: sirve de detector.
- 429 con formato de error del proyecto (`DEMASIADAS_SOLICITUDES`) y cabecera `Retry-After`. Pruebas con límites inyectables (`configurarLimites`, `reiniciarLimites`). Sin interruptor de desactivar en producción.
- IP del cliente: solo se confía en `X-Forwarded-For` si llega `X-Proxy-Clave` igual a `PROXY_CLAVE` (32 caracteres o más, comparación en tiempo constante). Si no, clave fija "local". Docker Desktop no conserva la IP: el límite por IP actúa como límite por equipo.
Proxy HTTPS: servicio `proxy` (Caddy, imagen por digest) en el perfil `proxy` de compose, puertos 127.0.0.1:8443 (TLS 1.2 y 1.3, `tls internal`, HSTS) y 127.0.0.1:8080 (redirección 308). Sitio `tracore.localhost`. La app sigue en 127.0.0.1:3000 para E2E, CI y rendimiento. Cookie `Secure` por petición (proxy y `x-forwarded-proto` https). Verificación con `scripts/verificar-tls.mjs` (TLS 1.0 y 1.1 rechazados con alerta del servidor, 1.2 y 1.3 aceptados, HSTS, 308).
Bitácora de accesos (tesis 4.8): valores nuevos de `accion_bitacora`: INICIAR_SESION, INICIO_SESION_FALLIDO, BLOQUEAR_CUENTA, CERRAR_SESION, CAMBIAR_CLAVE; entidad USUARIO. Migración propia con `ADD VALUE IF NOT EXISTS`. Sin contraseña, token, hash ni user-agent; IP truncada (IPv4 a /24, IPv6 a /48). Correo inexistente: sin fila (solo log cuando salta el límite). Riesgo aceptado: Gerencia ve IP truncada y correos de fallos; si Norman lo pide, el filtro de acciones de acceso queda solo para ADMIN.
Riesgos y detección: IP compartida por Docker Desktop (30 fallos bloquean el login de todo el equipo; log `LIMITE_TASA`); límite mal medido (rendimiento.mjs); redirecciones con `req.url` detrás de Caddy (E2E base con `E2E_BASE_URL=https://tracore.localhost:8443`); filtración de `PROXY_CLAVE` (alcance local); enum en la misma transacción (migrate deploy desde cero y Squawk); falso rechazo de TLS 1.0 (el script exige la alerta del servidor).

## ADR-018: dos monedas por cotización (2026-10-13)

Estado: aceptado por Norman (pedido directo). Diseño del agente arquitecto.
- La moneda de la cotización rige precio, costo, importe, descuento y totales.
- Columna `cotizacion.tipo_cambio NUMERIC(10,4)`: córdobas por 1 USD. En NIO vale 1. En USD se copia de la clave `tipo_cambio_usd` al crear y no se edita.
- Moneda y tipo de cambio no cambian después de crear. Duplicar y crear versión corregida los copian.
- Catálogo: `round(precioBase / tc, 2)`. Material con `materialId`: `round(costoPromedio / tc, 4)`. Los valores ya guardados no se convierten otra vez.
- CHECK de base: moneda en NIO o USD; tipo de cambio mayor que cero; en NIO igual a 1.
- Configuración: `tipo_cambio_usd` entre 1 y 1000 con hasta 4 decimales. Sin valor válido, crear en USD responde 409.
- Panel y reportes suman en córdobas equivalentes con `sum(round(total * tipo_cambio, 2))`. Los listados muestran la moneda original.
- Migración de expansión `20261013120000_cotizacion_moneda_tipo_cambio`. La reversión aborta si existen cotizaciones en USD.
- Riesgo aceptado: un redondeo de conversión de hasta 0.005 por precio de catálogo.

## ADR-019: confirmación de consumo e importación CSV (2026-10-13)

- Consumo: un diálogo «Confirmar consumo» lista material, cantidad y unidad. La petición con su clave de idempotencia se envía solo al confirmar. Las devoluciones no cambian.
- Importación CSV de clientes y materiales con `papaparse` y zod. Validación en seco, confirmación explícita, 500 filas y 1 MB como máximo.
- Cada fila se crea con el servicio de alta existente, en su propia transacción y con su evento CREAR en bitácora. Una fila inválida o duplicada se informa y no detiene las demás.
- No se modifican `crearCliente` ni `crearMaterial`.

## ADR-020: autenticación propia frente a Better Auth (2026-10-13)

Estado: diferido. Evaluación del agente arquitecto con documentación oficial de Better Auth.
- La autenticación propia ocupa unas 465 líneas (`src/lib/auth/*`, `src/modules/auth/service.ts` y 4 rutas).
- Better Auth cubre nativo: argon2id con `password.hash` y `verify`, TTL de sesión, revocación, sin autoservicio, compatibilidad con rol no dueño.
- Sigue propio: bloqueo a 5 fallos con UPDATE atómico, clave temporal con caducidad, cambio obligatorio, varios perfiles con matriz en base, bitácora con IP truncada, cookie Secure por solicitud, formato de errores de la API.
- Choques: guarda IP y user-agent de la sesión, y por defecto puede guardar el token en claro (nuestro token solo se guarda como SHA-256). Estos dos puntos no se verificaron en la fuente.
- Migrar eliminaría unas 120 líneas y agregaría 150 a 200 de configuración y hooks. Las sesiones vivas no se migran.
- Beneficio único: 2FA y passkeys, fuera del alcance del piloto (`docs/seguridad.md`).
- Decisión: diferir. Reabrir si la empresa pide 2FA o passkeys tras el piloto.
- Spike posterior (rama `spike/better-auth`, base `db_spike`, puerto 3100), aceptado solo si cumple todo:
  1. Pasan sin cambiar aserciones las suites `auth-*` y `e2e/base.spec.ts`.
  2. El 100 % de los usuarios de la siembra entra con su hash argon2id migrado.
  3. Ninguna columna guarda el valor de la cookie.
  4. Con 5 fallos hay 5 filas `INICIO_SESION_FALLIDO` y 1 `BLOQUEAR_CUENTA`, con IP /24 y sin user-agent.
  5. La cookie lleva Secure en 8443 y no en 3000 en la misma corrida.
  6. `migrate deploy` con `sc_app` y Squawk pasan; `rendimiento.mjs` da 0 respuestas 429 y p95 a más 10 % como máximo.
  7. Las líneas propias de autenticación no crecen frente a las 465 actuales.
- Costo estimado del spike: 18 horas.

## ADR-021: descuento en porcentaje y formato de cantidades (2026-10-14)

- Descuento comercial: se escribe como monto (como antes) o como porcentaje de 0 a 100 con hasta 2 decimales. Ambos a la vez dan 422.
- Columna `cotizacion.descuento_pct NUMERIC(5,2) NULL`. Con porcentaje, el servidor calcula `descuento = round(subtotal * pct / 100, 2)` al crear, editar, reemplazar ítems, duplicar, corregir y enviar. Escribir un monto limpia el porcentaje.
- El monto `descuento` sigue siendo la fuente para totales, base y reportes. La interfaz siempre lo muestra en moneda y, si hay porcentaje, rotula «Descuento (10 %)».
- Cantidades de material: sin ceros sobrantes (8, 3.7, 0.125). Una unidad discreta con fracción conserva su valor real (3.7 rollos no se redondea a 4). Los campos de entrada conservan el decimal exacto para editar.
- Costos y precios: 2 decimales con `formatearMoneda`. Se retiró el valor exacto de 7 decimales de la ficha de trazabilidad; el DTO conserva la precisión.
- Migración `20261014100000_cotizacion_descuento_pct`, con reversión en `prisma/migrations-down`.
