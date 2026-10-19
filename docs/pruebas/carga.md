# Pruebas de carga y concurrencia (k6)

Esta batería mide la aplicación bajo carga y verifica que los datos queden íntegros. Corre en un entorno aparte. No toca la base `sc_plataforma` ni la app del puerto 3000.

## Entorno
- Archivo: `docker-compose.carga.yml` (override de `compose.yaml`).
- Base: `sc_carga`, en el mismo servidor `db` (puerto 5442).
- App: servicio `app_carga` en `127.0.0.1:3100`. Usa la imagen `sc-plataforma-app`, con los mismos límites de memoria y CPU que `app`.
- Límites de tasa: valores de producción. El override no define `LIMITE_*`.
- Servicios nuevos: `carga_db` (crea la base), `carga_migrate` (migra, crea el rol y siembra el catálogo), `app_carga`.
- La imagen no se reconstruye sola. Tras cambiar `src`, ejecute `docker compose -f compose.yaml -f docker-compose.carga.yml build app_carga`.

## Cómo se corre
Requisitos: Docker Desktop, la imagen `grafana/k6:1.3.0` y las dependencias instaladas (`pnpm install`).

```sh
sh scripts/carga/correr.sh                       # los cuatro escenarios, en orden
sh scripts/carga/correr.sh concurrencia          # un solo escenario
sh scripts/carga/correr.sh --reiniciar-base pico # recrea sc_carga y siembra de cero
```

Opciones:
- `--reiniciar-base`: borra y recrea `sc_carga` (nunca `sc_plataforma`).
- `--sin-reinicio-app`: no reinicia `app_carga` entre escenarios. Por defecto se reinicia para que las métricas del proceso partan de cero.

Cada escenario puede correrse a mano. Siembre primero y luego lance k6:

```sh
node scripts/carga/sembrar-masivo.mjs
docker run --rm --add-host host.docker.internal:host-gateway \
  -v "$PWD/scripts/carga:/carga:ro" -v "$PWD/output/carga:/out" \
  grafana/k6:1.3.0 run --summary-export=/out/concurrencia.json /carga/k6/concurrencia.js
node scripts/carga/verificar-integridad.mjs --k6 output/carga/concurrencia.json
node scripts/carga/comparar-sistema.mjs --k6 output/carga/concurrencia.json
```

En Git Bash agregue `MSYS_NO_PATHCONV=1` antes de `docker run` y use `$(pwd -W)` en lugar de `$PWD`.

## Datos sembrados
`scripts/carga/sembrar-masivo.mjs` siembra en `sc_carga`:
- 1000 usuarios en los 6 perfiles (GERENCIA 100, ATENCION_CLIENTE 250, PRODUCCION 200, ADMIN 50, ADMINISTRACION 150, OPERACIONES 250).
- 2000 clientes y 300 materiales con existencias.
- 20 000 cotizaciones en los 6 estados, con un ítem de catálogo cada una.
- 1000 órdenes en los 6 estados, con sus etapas.
- 20 000 movimientos del libro, coherentes con las existencias. Pasan por los triggers del libro.
- Una sesión válida por usuario, escrita directo en la tabla `sesion`. El token y su hash siguen `src/lib/auth/tokens.ts`.

Las cotizaciones y las órdenes se cargan con `session_replication_role = replica`. Los triggers de transición no se ejecutan. Los CHECK y las claves únicas sí. Solo la carga histórica lo hace. Los escenarios usan la aplicación real.

Archivos generados (ignorados por git):
- `scripts/carga/sesiones.json`: cookie de cada usuario. Contiene credenciales válidas de `sc_carga`. No lo publique.
- `scripts/carga/concurrencia.json`: ids de los fixtures de la corrida.
- `scripts/carga/estado.json`: marca de corte. La verificación solo revisa lo ocurrido después.

Cada ejecución de `sembrar-masivo.mjs` crea fixtures nuevos y sesiones nuevas. El volumen no se vuelve a sembrar si ya existe.

## Escenarios (`scripts/carga/k6/`)
| Archivo | Qué hace |
|---|---|
| `lectura-mixta.js` | Rampa a 200 VU, 5 minutos. Listas con `q`, `orden` y paginación, fichas, panel, buscador global y contadores. Cada VU usa un usuario y solo lee lo que su perfil permite. |
| `pico.js` | De 0 a 1000 VU en 60 s, sostiene 30 s y baja en 60 s. Mismas lecturas. Un usuario por VU. |
| `concurrencia.js` | Rondas sincronizadas. 50 VU consumen el mismo material. 20 VU convierten la misma cotización aprobada. 20 VU editan el mismo cliente con la misma versión. |
| `resistencia.js` | 100 VU durante 10 minutos. Lecturas más una minoría de consumos y ediciones de cliente sobre registros de resistencia. |

Detalle de `concurrencia.js`:
- Hay 6 rondas. Cada ronda usa su propio material, su propia cotización y su propio cliente.
- Cada material de disputa tiene 100.000 de existencia. Cada VU pide 3.000. Caben 33 consumos por ronda. El resto debe recibir 409 `EXISTENCIA_INSUFICIENTE`.
- De la misma cotización gana una conversión (201). Las demás reciben 409 `ORDEN_EXISTENTE`.
- Del mismo cliente gana una edición (200). Las demás reciben 409 `CONFLICTO_EDICION`.
- Los umbrales exigen esos totales exactos: 198 consumos, 6 conversiones y 6 ediciones.

## Cómo leer los resultados
Salida en `output/carga/` (ignorada por git):
- `<escenario>.log`: salida de k6.
- `<escenario>.json`: resumen de k6 (`--summary-export`).
- `<escenario>-sistema.json`: comparación con `/api/v1/sistema`.
- `<escenario>-integridad.json`: revisiones de integridad.

### Umbrales de k6
- `http_req_duration{tipo:lectura}`: p(95) menor que 2000 ms. Solo cuenta lecturas.
- `errores_5xx`: debe ser 0.
- `checks`: más de 99 % correctos. En lectura, cada respuesta debe ser 200.
- Marca de k6: `✓` cumple, `✗` no cumple. Con umbral incumplido, k6 sale con código 99 y `correr.sh` cuenta un fallo.

### Respuestas esperadas
- Se tratan como esperadas: 2xx, 409, 422 y 429. No suben `http_req_failed`.
- Se cuentan aparte: `respuestas_409`, `respuestas_422`, `respuestas_429`.
- Un 409 en `concurrencia.js` es parte del diseño. Un 429 en lectura indica que el límite de tasa se alcanzó. Revise la causa antes de aceptarlo.
- Cualquier otro 4xx o 5xx cuenta en `http_req_failed`. Los 5xx cuentan además en `errores_5xx`.

### Integridad (`verificar-integridad.mjs`)
Sale con código 0 si todo pasa y 1 si algo falla. Revisa:
- Existencia de cada material igual a la suma de su libro.
- Sin existencias negativas, ni en el material ni en el libro.
- Máximo una orden por cotización.
- Cada orden nueva tiene un solo evento `CONVERTIR_EN_ORDEN`.
- Cada consumo o devolución nuevo tiene un solo evento de bitácora, y no hay eventos sin movimiento.
- Cada cliente de disputa tiene como máximo una edición ganadora, y su nota coincide con el evento.
- Con `--k6`: las órdenes, ediciones y consumos de la base coinciden con los contadores de k6.

Una falla aquí es un defecto de datos, aunque k6 haya pasado.

### Comparación con el sistema (`comparar-sistema.mjs`)
Lee `/api/v1/sistema` con una sesión ADMIN y lo pone junto al resumen de k6. Compara p95, tasa de 5xx, tasa de 4xx y peticiones.
- El sistema conserva solo las últimas 500 peticiones del proceso. Su p95 y sus tasas describen el final de la corrida, no toda.
- k6 mide extremo a extremo. El sistema mide dentro del proceso. Se espera un p95 de k6 mayor o igual.
- Un `DIFERENCIA:` en la salida marca un desacuerdo de criterio (por ejemplo 5xx que solo ve uno de los dos). Revíselo.
- Corra la comparación justo después de k6. Si pasa tiempo o se reinicia la app, la ventana cambia.

## Después de las pruebas
- La base demo no se afecta. `pnpm demo:reiniciar` no es necesario.
- Para borrar todo: `sh scripts/carga/reiniciar-base.sh`.
- Para apagar el entorno: `docker compose -f compose.yaml -f docker-compose.carga.yml stop app_carga`.
