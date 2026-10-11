# Prueba de respaldo y recuperación (RNF-06 y RNF-07)

Fecha: 2026-10-10. Entorno: Docker Compose local, PostgreSQL 17, base de demostración.

## Requisitos (tesis v9, Tabla de requisitos no funcionales)
- RNF-06: al menos un respaldo exitoso cada 24 horas.
- RNF-07: restauración sin errores de integridad en un máximo de 4 horas.

## Mecanismo
- Respaldo manual: `sh scripts/respaldo.sh [carpeta]` (pg_dump formato custom, falla sin dejar archivos vacíos).
- Respaldo programado: servicio `respaldo` de `compose.yaml`, sin perfil adicional.
  - Inicie aplicación y respaldo mediante `docker compose up -d`.
  - Inicie solo respaldo mediante `docker compose up -d respaldo`.
  - Ejecuta `scripts/respaldo-programado.sh`: respalda al arrancar y cada `INTERVALO_HORAS` (24 por defecto).
  - Solo cuenta un respaldo que `pg_restore --list` puede leer.
  - Conserva `RETENCION_DIAS` (7). Reintenta cada hora si falla.
  - Bitácora: `/respaldos/registro.log` en el volumen `sc_respaldos` (fecha ISO, OK o FALLO, archivo, bytes).
- Restauración: `sh scripts/restaurar.sh <archivo.dump> --confirmar` (detiene la aplicación, restaura, reaplica permisos).

## Método de la prueba
`sh scripts/prueba-recuperacion.sh` (no toca la base en uso):
1. Respalda con `respaldo.sh` y mide el tiempo.
2. Restaura en una base temporal `sc_recuperacion` con `pg_restore --exit-on-error` y mide el tiempo.
3. Compara el conteo de filas de todas las tablas públicas contra la base de origen.
4. Verifica en la restaurada: restricciones validadas, existencias no negativas, existencia igual a la suma del libro de inventario, sin registros huérfanos (orden sin cotización, consumo sin orden) y sin órdenes duplicadas por cotización.
5. Elimina la base temporal y emite el veredicto contra el límite de 14 400 s.

## Resultado (2026-10-10)
| Medida | Valor |
|---|---|
| Archivo de respaldo | 160 077 bytes |
| Tiempo de respaldo | 1 s |
| Tiempo de restauración | 2 s (límite 14 400 s) |
| Tablas comparadas | 24, sin diferencias de conteo |
| Restricciones sin validar | 0 |
| Existencias negativas | 0 |
| Descuadre existencia contra libro | 0 |
| Registros huérfanos | 0 |
| Órdenes duplicadas por cotización | 0 |
| Veredicto | cumple RNF-06 (respaldo verificable) y RNF-07 |

Servicio programado: arrancado dos veces el mismo día; el registro muestra dos líneas OK con archivo y tamaño.
Conserve estos resultados de 2026-10-10; no equivalen a una nueva corrida v9.
Revise el registro mediante `docker compose exec respaldo cat /respaldos/registro.log`.

## Limitaciones
- Volumen de datos de demostración (cientos de filas). El tiempo crece con el tamaño; el margen frente a 4 horas es amplio.
- Se probó en la misma máquina y volumen de Docker. Para operación real, copiar el volumen `sc_respaldos` a otro equipo o disco.
- La verificación de las 24 horas depende de que el servicio `respaldo` esté activo; el registro es la evidencia.
