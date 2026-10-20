# Informe de rendimiento RNF-01

Estado: corrida corregida registrada; resultado `CUMPLE` (2026-10-11).
Evidencia: `docs/pruebas/resultado-rendimiento.json`, fecha UTC 2026-10-11T16:55:14Z. El archivo de datos crudos se conserva en local y no se versiona por su tamaño (3,6 MB); se regenera con `node scripts/rendimiento.mjs`.
La primera corrida y la corrida intermedia quedan como antecedentes en las secciones siguientes.

## Resultado vigente (2026-10-13, código final)

Fuente única de cifras para el resto de la documentación. Las secciones siguientes conservan el historial.
Condiciones: 20 sesiones, 60 s, aplicación en `http://127.0.0.1:3000`, límite de tasa de ADR-017 activo, siembra de 18 clientes.

| Tipo | n | p50 (ms) | p95 (ms) | p99 (ms) | Máximo (ms) | ≤ 2000 ms (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Consulta | 14418 | 78.19 | 106.39 | 129.00 | 208.15 | 100.00 |
| Creación | 288 | 83.57 | 107.29 | 129.76 | 136.39 | 100.00 |
| Actualización | 144 | 91.80 | 109.47 | 148.81 | 156.73 | 100.00 |
| Global | 14850 | 78.43 | 106.54 | 129.10 | 208.15 | 100.00 |

Decisión RNF-01: CUMPLE. Errores HTTP: 0; 5xx: 0; red: 0; respuestas 429: 0.
Datos crudos: `docs/pruebas/resultado-rendimiento.json`.
Esta corrida crea 288 clientes de prueba (archivados al final). Tras correrla, ejecute `pnpm demo:reiniciar` para limpiar la base de demostración.

## Objetivo

Verifique RNF-01 de la tesis v9 con 20 sesiones concurrentes.
Exija respuestas en 2000 ms o menos para al menos 95 % de operaciones.
Evalúe consultas, creaciones y actualizaciones por separado.
Evalúe también todas las operaciones juntas.

## Entorno

Datos de la corrida final.

| Dato | Valor |
| --- | --- |
| CPU | Intel Core i7-12650H, 16 procesadores lógicos |
| Memoria | 31.6 GB instalados |
| Sistema operativo | win32, según JSON |
| Versión de Node | v26.4.0 (generador de carga en el anfitrión) |
| Versión de la aplicación | 0.1.0, commit 67cb2d7 más cambios locales de pulido |
| Modo de ejecución | Producción: imagen Docker con `next start`, base PostgreSQL en contenedor en el mismo equipo |
| Versión de PostgreSQL | 17.11 (Alpine, contenedor `db`) |
| Tamaño inicial de la base | Base recién sembrada con datos de demostración (siembra v9) |
| Fecha UTC | 2026-10-11T16:55:14.697Z |
| URL local | http://127.0.0.1:3000 |
| Duración solicitada y medida | 60 s; 60.0612374 s |
| Sesiones iniciadas | 20 |

## Método

Distribuya las sesiones entre los usuarios de la siembra mediante rotación.
Obtenga una cookie independiente mediante login para cada sesión.
Lea las claves exclusivamente desde variables de entorno.
Envíe Origin con el origen indicado mediante `--base`.
Restrinja la URL base a localhost, 127.0.0.1 o ::1.

Compruebe las consultas disponibles antes de medir.
Considere las rutas de panel, clientes, cotizaciones, órdenes y `/api/v1/produccion/tablero`.
Pruebe `/api/v1/materiales`.
Descarte únicamente las consultas previas con estados 403 o 404.
Registre las comprobaciones previas dentro de `preparacion`.
Cancele la medición ante otros errores previos, incluidos 401 y 429.

Inicie todas las sesiones conjuntamente mediante promesas concurrentes.
Mantenga una petición pendiente por sesión.
Repita este ciclo durante la duración solicitada:

1. Ejecute siete consultas mediante rotación de rutas disponibles.
2. Cree dos clientes con nombres y RUC sintéticos únicos mediante POST.
3. Actualice las notas del último cliente mediante PATCH con su `version`.

Use el prefijo `RENDIMIENTO-` en el nombre.
Limite el RUC sintético a 20 caracteres.
Use `actualizadoEn` como `version` ISO para posteriores mutaciones.
Ejecute consultas cuando el perfil carezca de `cliente:gestionar`.
Registre los errores HTTP, incluidos 401, 403 y 429.
Omita PATCH cuando ninguna creación entregue un cliente con versión válida.
Registre esas omisiones sin inventar peticiones medidas.

Mida cada petición mediante `performance.now()` hasta consumir completamente su respuesta.
Incluya todos los estados HTTP en las estadísticas.
Penalice las peticiones sin respuesta dentro del porcentaje temporal.
Limite cada petición a 30 segundos.
Finalice las peticiones pendientes cuando venza la duración solicitada.
Permita que esa espera prolongue la duración medida.
Registre la mezcla observada porque los ciclos finales pueden quedar incompletos.

Calcule percentiles mediante rango más cercano sobre duraciones ordenadas.
Seleccione la posición `ceil(p / 100 × n)`, contando desde uno.
Represente los percentiles sin muestras mediante `null`.
Use valores sin redondear para decidir.
Redondee únicamente la tabla impresa a dos decimales.

Excluya login, comprobaciones previas y archivado de las estadísticas temporales.
Archive todos los clientes identificados mediante `POST /api/v1/clientes/{id}/archivar`.
Ejecute el archivado incluso cuando falle la medición.
Registre los errores de archivado y sus identificadores en el JSON.
Revise manualmente las creaciones inciertas tras errores de red o respuestas incompletas.

## Ejecución

Prepare una instancia local con datos de demostración y usuarios de siembra.
Exporte las variables mediante el mecanismo habitual del entorno.
Mantenga sus valores fuera del informe y del historial de comandos.

```text
SEED_PASSWORD_GERENCIA
SEED_PASSWORD_ATENCION_CLIENTE
SEED_PASSWORD_OPERACIONES
SEED_PASSWORD_ADMINISTRACION
SEED_PASSWORD_ADMIN
SEED_PASSWORD_PRODUCCION
```

Ejecute desde la raíz del proyecto:

```powershell
node scripts/rendimiento.mjs --base http://127.0.0.1:3000 --sesiones 20 --duracion 60 --salida docs/pruebas/resultado-rendimiento.json
```

Pegue la tabla impresa en la sección de resultados.
Adjunte el JSON generado como evidencia de la medición.
Compruebe `limpieza` y archive manualmente cualquier cliente pendiente.
Interprete código de salida 1 como incumplimiento, ejecución incompleta o archivado pendiente.

## Criterio

Exija al menos 95 % dentro de 2000 ms globalmente y para cada tipo.
Exija cero errores 5xx y cero respuestas 4xx inesperadas.
Permita únicamente respuestas 403 durante la preparación de rutas.
Exija la duración solicitada para todas las sesiones.
Exija muestras para los tres tipos.
Marque `NO EVALUABLE` ante errores de ejecución, sesiones faltantes, omisiones o creaciones inciertas.
Compruebe que la ejecución use 20 sesiones antes de validar RNF-01.

Revise también los errores HTTP y los errores de red.
Distinga una respuesta rápida de una operación completada correctamente.
El criterio temporal contabiliza respuestas 4xx; la decisión exige cero respuestas 4xx inesperadas.
Las escrituras requieren permisos para gestionar clientes.
Los perfiles sin esos permisos ejecutan consultas.

## Resultados de la corrida final: CUMPLE

Corrida con 20 sesiones durante 60 s sobre la aplicación en producción y la base recién sembrada.
La corrida intermedia (16:51 UTC) dio 100 % bajo 2 s, pero marcó NO CUMPLE por 40 respuestas 404.
Causa: la preparación sondeaba `/api/v1/produccion` y `/api/v1/inventario/materiales`, rutas que no existen.
Se corrigieron las rutas del script y se repitió la corrida.

| Tipo | n | p50 (ms) | p95 (ms) | p99 (ms) | Máximo (ms) | ≤ 2000 ms (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Consulta | 14514 | 75.70 | 115.86 | 144.00 | 228.41 | 100.00 |
| Creación | 292 | 80.53 | 124.34 | 145.43 | 190.98 | 100.00 |
| Actualización | 146 | 87.89 | 122.16 | 149.90 | 185.64 | 100.00 |
| Global | 14952 | 75.94 | 116.10 | 144.28 | 228.41 | 100.00 |

| Dato adicional | Valor |
| --- | --- |
| Decisión | CUMPLE |
| Errores HTTP | 0 (5xx: 0; red: 0) |
| Operaciones omitidas | 0 |
| Creaciones inciertas | 0 |
| Clientes archivados | 292 de 292 |
| Archivo JSON | `docs/pruebas/resultado-rendimiento.json` |

Resultado: el 100 % de las operaciones respondió en 2000 ms o menos, con p95 de 116 ms en total y por tipo.
La base tiene datos de demostración; ver limitaciones.

## Resultados de la primera corrida: NO EVALUABLE

Conserve estos valores de `resumenes` en el JSON; redondee solo para presentación.
Los conteos por tipo reflejan la clasificación de la primera versión del script.
Esa versión clasificaba algunas consultas como escrituras según su posición en el ciclo.
Recalcule por método efectivo durante la corrida corregida.

| Tipo | n | p50 (ms) | p95 (ms) | p99 (ms) | Máximo (ms) | ≤ 2000 ms (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Consulta | 11167 | 75.45 | 95.33 | 112.11 | 143.95 | 100 |
| Creación | 3168 | 75.82 | 94.55 | 112.33 | 129.07 | 100 |
| Actualización | 1396 | 75.66 | 94.62 | 106.99 | 132.03 | 100 |
| Global | 15731 | 75.55 | 95.19 | 112.02 | 143.95 | 100 |

| Dato adicional | Valor |
| --- | --- |
| Decisión | NO EVALUABLE |
| Mezcla observada | Clasificación histórica: consulta 70.99 %, creación 20.14 %, actualización 8.87 % |
| Errores HTTP por estado | 372 respuestas 422 |
| Errores 5xx | 0 |
| Errores de red | 0 |
| Operaciones omitidas | 186 |
| Creaciones inciertas | 0 registradas |
| Clientes archivados y pendientes | `limpieza: []`; el JSON no demuestra el archivado |
| Archivo JSON | `docs/pruebas/resultado-rendimiento.json` |

Los resultados finales constan en la sección de la corrida final.

## Notas de la primera corrida

Registre 15 731 peticiones, p95 de 95 ms y 100 % por debajo de 2 s.
Registre la decisión `NO EVALUABLE` y 372 respuestas 422.
Registre limpieza `0/0` y aproximadamente 3 000 clientes `RENDIMIENTO-*` todavía activos.
Mantenga estos datos como observaciones de la primera corrida.
Reserve los resultados finales para el orquestador.

Use `actualizadoEn` como `version` ISO en PATCH y archivado.
Actualice esa versión con cada respuesta PATCH.
Cambie únicamente `notas` mediante un contador corto.
Evite acumular sufijos en nombres; el límite es 200 caracteres.
Limite el RUC de prueba; el identificador anterior supera el límite de 20 caracteres.
Consulte `primeros422` para identificar errores futuros por tipo y ruta.
Conserve únicamente mensajes de validación permitidos, sin datos personales.
Evite atribuir los 372 errores a una causa sin sus cuerpos de respuesta.

Cuente como consultas las operaciones ejecutadas por perfiles sin `cliente:gestionar`.
Archive todos los clientes identificados durante la nueva corrida.
Consulte `resumenLimpieza` para conocer archivados, total y pendientes.
Revise `limpieza` para identificar archivados fallidos.
Interprete código de salida 1 ante cualquier archivado fallido.
Archive por separado los clientes pendientes de la primera corrida.

Exija la duración solicitada para todas las sesiones.
Exija cero respuestas 5xx y cero respuestas 4xx inesperadas.
Excluya únicamente los 403 de preparación de rutas del conteo de errores inesperados.
Exija muestras, p95 máximo de 2000 ms y al menos 95 % dentro del umbral.
Evalúe globalmente y por consulta, creación y actualización.
Consulte `causas` cuando la decisión difiera de `CUMPLE`.

## Limitaciones

Considere la red local y la ausencia de TLS.
Considere una base con datos de demostración.
Considere el calentamiento causado por las comprobaciones previas.
Considere la interferencia del generador si comparte CPU con la aplicación.
Considere los ciclos incompletos al finalizar el intervalo.
Considere las restricciones de permisos y los límites de login por dirección IP.
Considere que un cliente creado podría quedar sin identificar tras un fallo de red.
Considere que archivar conserva los registros y aumenta el tamaño de la base.
Considere que veinte sesiones con solicitudes secuenciales representan un modelo cerrado.
Evite extrapolar estos resultados a internet, bases mayores o cargas de llegada constante.
