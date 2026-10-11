# Reversión versionada de migraciones v9

Detenga la aplicación durante todo el procedimiento.
Detenga también procesos externos que escriban o ejecuten migraciones.
Mantenga únicamente la base disponible para respaldar y revertir.
Ejecute los comandos desde la raíz del proyecto, mediante una terminal POSIX.

```sh
docker compose stop app migrate
sh scripts/db/revertir.sh 20261011030000_historial_responsable_obligatorio --confirmar
```

Exija `--confirmar`; el script rechaza su ausencia.
Revise el comentario inicial del `down.sql` antes de confirmar.
Conserve el respaldo custom creado por `scripts/respaldo.sh` dentro de `respaldos/reversion-<migracion>-<identificador>/`.
Compruebe el respaldo con `pg_restore --list <archivo.dump>` antes de cualquier recuperación.

Revierta solamente la última migración aplicada.
Repita el comando siguiendo este orden descendente:

1. `20261011030000_historial_responsable_obligatorio`
2. `20261011020000_usuario_sin_perfil_id`
3. `20261011015300_historial_etapa_restricciones_v9`
4. `20261010100600_consumo_cantidad_costo_clave`
5. `20261010100500_orden_cliente_responsable_opcional`
6. `20261010100400_cotizacion_aprobacion_version`
7. `20261010100300_cotizacion_ajuste_enum`
8. `20261010100200_cliente_codigo_producto_costo`
9. `20261010100100_usuario_perfil`
10. `20261010100000_perfiles_v9_enum`

Resuelva primero cualquier migración posterior mediante su procedimiento autorizado.
Considere `20261011040000_indices_auditoria` y `20261011050000_usuario_clave_temporal` fuera de este alcance.
El script bloquea migraciones posteriores aplicadas y migraciones incompletas.

Use `psql` del contenedor `db` con las variables `POSTGRES_USER` y `POSTGRES_DB`.
El script evita imprimir credenciales.
Ejecute cada `down.sql` con `ON_ERROR_STOP` dentro de una única transacción.
El script elimina su registro aplicado de `_prisma_migrations` dentro de esa misma transacción.
Ante errores, conserve el esquema y el registro mediante rollback automático.
Corrija la causa antes de repetir; no ejecute manualmente un `down.sql` parcialmente.
Evite desplegar migraciones mientras dure el procedimiento.

## Límites y recuperación

| Migración | Límite | Recuperación |
| --- | --- | --- |
| `20261010100000` | Persisten `ADMINISTRACION` y `OPERACIONES`; PostgreSQL no elimina valores con `ALTER TYPE`. | Restaure un respaldo anterior para recuperar exactamente el enum original. |
| `20261010100100` | Pierda asignaciones adicionales y auditoría; los permisos originales ya fueron eliminados por el avance. | Recupere permisos desde un respaldo anterior a v9; conserve asignaciones mediante el respaldo previo al down. |
| `20261010100200` | Pierda códigos de cliente, secuencia y costos registrados. | Recupérelos desde el respaldo previo al down. |
| `20261010100300` | Persiste `AJUSTE_SOLICITADO`. | Restaure un respaldo anterior para recuperar exactamente el enum original. |
| `20261010100400` | Pierda aprobación, versión y motivo de ajuste. | Recupérelos desde el respaldo previo al down. |
| `20261010100500` | El esquema anterior exige responsables; eliminar `cliente_id` elimina su copia. | Asigne responsables explícitamente; conserve la referencia mediante `cotizacion.cliente_id`. |
| `20261010100600` | Pierda claves de idempotencia y copias de cantidad y costo. | Recupere claves desde el respaldo; consulte valores originales en `movimiento_inventario`. |
| `20261011015300` | Pierda `historial_etapa`, incluidos registros exclusivos de esa tabla. | Recupérelos desde el respaldo; la bitácora conserva únicamente sus propios eventos. |
| `20261011020000` | El perfil original eliminado resulta ambiguo para usuarios con múltiples perfiles. | Restaure la columna desde `usuario_perfil` con el perfil principal vigente. |
| `20261011030000` | No identifique responsables originalmente nulos después del relleno. | Conserve valores actuales; restaure un respaldo anterior para recuperar los nulos originales. |

Restaure `usuario.perfil_id` como UUID inicialmente nullable.
Seleccione el perfil principal mediante `DISTINCT ON (usuario_id)` sobre `usuario_perfil` unido a `perfil`.
Respete este orden definido en `src/core/permisos.ts`:
`GERENCIA`, `ADMINISTRACION`, `OPERACIONES`, `ATENCION_CLIENTE`, `PRODUCCION`, `ADMIN`.
Aborte si algún usuario carece de asignaciones.
Después, restaure `NOT NULL`, la clave foránea y el índice `(perfil_id, activo)`.
Conserve `usuario_perfil` hasta revertir `20261010100100`.
Recupere el perfil histórico exacto desde un respaldo anterior a `20261011020000` cuando resulte necesario.

Antes de arrancar código anterior, resuelva registros con perfiles nuevos o estado `AJUSTE_SOLICITADO`.
Apruebe cualquier reasignación de perfiles o estados mediante una decisión de negocio.
Restaure los permisos anteriores desde el respaldo previo a v9.
No espere recuperar pérdidas del avance desde un respaldo posterior al avance.
Pruebe cualquier restauración en una base aislada antes de sustituir la base operativa.
Restaure mediante `pg_restore` sobre una base vacía con el esquema correspondiente al respaldo.
Despliegue código, esquema Prisma y migraciones compatibles antes de reiniciar la aplicación.
Evite `migrate deploy` con el directorio actual: aplicaría nuevamente las migraciones revertidas.

## Verificación pendiente del orquestador

Prepare una base aislada con datos anteriores a v9.
Aplique el avance hasta `20261011030000` y revierta las diez migraciones en orden descendente.
Compare tablas, columnas, restricciones, índices, triggers, funciones y secuencias con el esquema anterior.
Admita únicamente los valores enum residuales documentados.
Compruebe el perfil principal con usuarios que tengan múltiples perfiles.
Compruebe el rechazo de usuarios sin perfiles y órdenes sin responsables.
Compruebe el rechazo sin `--confirmar`, con nombres inválidos y con migraciones posteriores.
Simule fallos de respaldo y SQL; compruebe la conservación del esquema y del registro aplicado.
Compruebe que cada respaldo permita recuperar los datos eliminados por su reversión.
Conserve los resultados de integración; esta tarea no ejecuta PostgreSQL.
Considere TypeScript una comprobación del proyecto; los archivos nuevos no contienen TypeScript.
Considere ESLint sin reglas aplicables para SQL, Shell y Markdown con la configuración actual.
Complete la comprobación sintáctica POSIX en el entorno del orquestador.
