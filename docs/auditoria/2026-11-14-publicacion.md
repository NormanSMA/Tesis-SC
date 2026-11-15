# Publicación del avance — 2026-11-14

Alcance autorizado: publicar todos los cambios del proyecto en la rama existente, sin coautores. Se incluyen código, pruebas, cinco migraciones pendientes, documentación, copia del registro Word hasta GEN-08 y las 31 capturas de evidencia disponibles. No se publican entornos, contraseñas, sesiones, respaldos ni el estado operativo local. Los registros de la base real no se transfieren mediante Git.

## Ajustes técnicos de preparación

Se separó el esquema de selección de producto de la función que aplica la selección y se movió el tipo de instalación fuera del componente visual. Se eliminaron los dos ciclos de dependencias detectados, manteniendo exactamente el esquema, los tipos y el comportamiento. No cambian las fórmulas, servicios o permisos.

Las 16 migraciones de esta rama posteriores a main ya estaban aplicadas localmente y se conservan sin reescribir SQL ni alterar sus checksums. La revisión con Squawk encontró 49 avisos históricos: falta de límites de espera, restricciones validadas inmediatamente, sustitución de restricciones según cambios funcionales aprobados e índices construidos en mantenimiento. El único DROP TABLE señalado elimina una tabla TEMP creada en el mismo archivo. No se elimina una tabla de negocio.

Se registra la revisión en `.github/squawk-revisadas.json` mediante SHA-256 del SQL con saltos LF, regla y ubicación exacta de cada aviso, con motivo explícito. `scripts/auditoria/migraciones.mjs` verifica las huellas antes de auditar y rechaza modificaciones del histórico y cualquier hallazgo no revisado. No hay exclusión global nueva de reglas. Squawk queda fijado por digest y se ejecuta también sobre migraciones todavía sin commit. Tres pruebas verifican que no se acepten SQL modificado, ubicaciones incompletas, reglas distintas o migraciones nuevas por pertenecer a este registro. CI local y workflow comparten el auditor.

Esta revisión no autoriza desplegar estas operaciones con tráfico sin evaluar bloqueos. Las futuras migraciones deben fijar tiempos de espera y evaluar validación separada e índices concurrentes. Las advertencias históricas permanecen visibles como revisadas; no se presenta el resultado como cero advertencias SQL.

## Verificación

- CI local completo: los 18 pasos aprobados, nueve secciones funcionales, en 477 segundos. Tipos, ESLint, distribución de pruebas, compilación, dependencias sin CRITICAL, ciclos/capas, secretos e histórico SQL aprobados.
- Interfaz: 97 pruebas aprobadas en cinco archivos.
- Auditor SQL: tres pruebas aprobadas; 16 archivos, 49 avisos históricos revisados y cero avisos nuevos. Sin cambios en los SQL históricos.
- Gitleaks: historial y cambios preparados para commit sin hallazgos. El Word no contiene la clave fija local y su texto se comprueba por separado porque DOCX es un contenedor binario.
- La auditoría de dependencias mantiene nueve avisos no críticos (dos low, cuatro moderate, tres high); la política existente bloquea CRITICAL. No se declara que no existan vulnerabilidades.

Para reproducir CI en este equipo se cargaron `.env.example` y el entorno local sin imprimir sus valores. Un puente temporal fuera del repositorio mantuvo pnpm 10.22 con la gestión automática de versiones desactivada, evitando la instalación local incompleta de pnpm 11.1.1; no se cambiaron versiones del proyecto ni el lockfile. El CI remoto usa la versión declarada por el proyecto.

Solo db_test se inició temporalmente. La web, base real y respaldo permanecieron detenidos. Al cerrar la publicación se detiene también db_test. Sin migración, seed o operaciones de negocio sobre la base real. El registro Word conserva su contenido y formato ya revisados; la copia versionada es idéntica al maestro.
