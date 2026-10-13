# Tecnologías y librerías de TRACORE

Fecha: 2026-10-13. Fuente de versiones: `package.json`.
Este documento alimenta las próximas entregas del PCE.
Cada librería nueva tiene propósito, lugar de uso, beneficio y alternativa evaluada.

## Principio de selección

Adopte componentes del mercado cuando resuelven un problema ya resuelto y probado.
Escriba código propio solo para reglas de negocio de Soluciones Creativas.
Criterios de adopción: mantenimiento activo, licencia permisiva, sin dependencias nativas nuevas, cabe en la CSP vigente y se prueba en CI.

## Base del sistema (ya documentada en el Capítulo IV)

| Componente | Versión | Rol |
|---|---|---|
| Next.js | 16.3.8 | Interfaz y API en un solo repositorio (ADR-001). |
| React | 19.3.0 | Componentes de interfaz. |
| Prisma | 7.10.0 | Acceso a datos y migraciones (ADR-002). |
| PostgreSQL | 17 | Reglas de integridad con CHECK, triggers y transiciones (ADR-003). |
| zod | 4.x | Validación única de entradas en servidor y cliente. |
| Tailwind 4 y shadcn/ui (Radix) | 4.x | Sistema de diseño accesible. |
| @node-rs/argon2 | 2.x | Hash de contraseñas con argon2id. |
| exceljs | 4.4 | Exportación XLSX. |
| Vitest, Playwright, axe-core | 4.1, 1.63, 4.13 | Pruebas unitarias, de integración, E2E y accesibilidad. |

## Librerías incorporadas en esta fase

| Librería | Versión | Para qué | Dónde se usa | Beneficio | Alternativa evaluada |
|---|---|---|---|---|---|
| server-only | 0.0.1 | Impide importar código de servidor desde el cliente. | `src/lib/db.ts`, `src/lib/auth/*`, servicios. | Un import equivocado rompe la compilación en lugar de filtrar código o secretos al navegador. | Convención de carpetas sin control automático. |
| @t3-oss/env-nextjs | 0.13.x | Valida con zod las variables de entorno al arrancar. | `src/env.ts`; lectura dinámica con `leerEntorno()`. | Falla rápido si falta o es inválida una variable. Un solo lugar documenta la configuración. | `process.env` disperso con validaciones sueltas. |
| pino | 10.x | Registro estructurado en JSON con redacción. | `src/lib/registro.ts`, `src/lib/http.ts`, `src/lib/errores.ts`, autenticación. | Contraseñas, cookies y tokens no llegan al registro. Formato apto para agregadores. | `console.log` sin redacción. winston: más pesado y sin redacción por ruta nativa. |
| rate-limiter-flexible | 11.x | Límite de tasa por usuario e IP con almacén en memoria. | `src/lib/limite-tasa.ts`; API y login. | Responde 429 con `Retry-After` ante abuso. Un solo proceso no necesita Redis. | express-rate-limit: ligado a Express. Redis: infraestructura extra sin necesidad hoy. |
| papaparse | 5.7.x | Lectura de CSV con comillas, BOM y separadores. | `src/modules/importacion/csv.ts`. | Analizador probado. La validación de filas sigue en zod. | `split(",")` casero: falla con comillas y saltos de línea. csv-parse: más pesado para el navegador. |

Decisiones relacionadas: ADR-017 (límite de tasa, proxy TLS y bitácora de accesos) y ADR-019 (importación y confirmación).

## Infraestructura incorporada

| Componente | Para qué | Dónde | Beneficio | Alternativa evaluada |
|---|---|---|---|---|
| Caddy 2 (imagen `caddy:2-alpine`) | Proxy inverso con TLS 1.2 y 1.3, HSTS y redirección 308. | `infra/Caddyfile`, servicio `proxy` de `compose.yaml`. | Cierra RNF-04 con una configuración de pocas líneas y certificados automáticos. | nginx: más configuración manual de TLS. Traefik: más piezas para un solo servicio. |
| Límites de CPU y memoria en Compose | Acota el consumo de cada contenedor. | `compose.yaml`. | Un servicio descontrolado no ahoga a los demás. | Sin límites. |

## Evaluadas y descartadas por ahora

| Librería | Motivo del descarte | Cuándo reconsiderar |
|---|---|---|
| next-themes (modo oscuro) | Norman pidió terminar primero el tema claro. El trabajo hecho y probado está guardado en la bóveda (`wiki/projects/sc-plataforma/modo-oscuro-pendiente`). | Cuando el tema claro quede aprobado. |
| TanStack Query | El sistema usa componentes de servidor y un hook propio acotado por pantalla. Agregarla duplicaría la caché. | Si aparecen pantallas con sondeo, actualización optimista o caché compartida. |
| TanStack Table | Las tablas actuales son simples y accesibles con HTML semántico. | Si se piden columnas redimensionables, agrupación o virtualización. |
| CASL | La matriz rol-permiso vive en `src/core/permisos.ts` y se edita desde la base. Es pequeña, tipada y probada. | Si surgen permisos por registro o por atributo. |
| tRPC | La API REST con zod ya sirve a la interfaz y es contrato público para pruebas y reportes. | Si hubiera varios clientes TypeScript que compartan tipos. |
| Zustand (equivalente de Pinia en Vue) | Casi no hay estado global de cliente. El estado vive en el servidor o en el formulario. | Si aparece estado compartido entre pantallas lejanas. |

## Autenticación: Better Auth

Estado: pendiente de evaluación en una rama aparte (Fase 5 del plan).
Criterio de aceptación: pasan la sección `acceso` y los E2E de acceso con cambios menores, y los datos migran sin pérdida.
Condiciones propias que debe conservar: bloqueo a cinco intentos, clave temporal con caducidad, argon2id y bitácora de accesos.
Si no cumple, queda como decisión posterior a la validación del piloto.
El resultado se registra aquí al cierre de la evaluación.

## Impacto en la tesis

- Tabla de pila tecnológica: reemplazar la pila anterior (React, NestJS, TypeORM) por la real de la sección «Base del sistema».
- Seguridad (4.8): agregar redacción de registros, límite de tasa, validación de entorno y TLS 1.2 o superior con HSTS.
- Evidencia: `docs/pruebas/tls.md` (RNF-04) y `docs/pruebas/rendimiento-RNF-01.md`.
