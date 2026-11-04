# Actualización de seguridad del 2026-11-04

Durante las verificaciones para compartir el script de usuarios reales, `pnpm audit --prod --audit-level=critical`
detectó dos avisos críticos en Next.js 16.3.8. El usuario autorizó incluir su corrección antes de publicar.
Se actualizan `next` y `eslint-config-next` a 16.4.1, conservando las versiones fijadas y el archivo de bloqueo.

Avisos del mantenedor con versión corregida 16.4.1:

- https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr

El resultado de la auditoría identifica paquetes afectados; no demuestra que la aplicación haya sido explotada.
La actualización no cambia el modelo de datos ni las reglas de negocio.

La prueba de dimensiones de imágenes deja de importar `getSharp` desde una API interna de Next.js,
retirada en esta versión. Usa directamente Sharp 0.35.5, declarado como dependencia de desarrollo,
y conserva la verificación de formato WebP y dimensiones de 640 por 640 píxeles.

También se corrige la ejecución de Docker desde `scripts/ci-local.mjs` en Windows:
se pasan sus argumentos directamente al proceso, para conservar las rutas con espacios.
Los comandos de pnpm siguen usando el intérprete necesario para sus lanzadores `.cmd`.
