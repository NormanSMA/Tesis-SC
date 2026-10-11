# Informe de rendimiento RNF-01

## Objetivo

Verifique RNF-01 de la tesis v9 con 20 sesiones concurrentes.
Exija respuestas en 2000 ms o menos para al menos 95 % de operaciones.
Evalúe consultas, creaciones y actualizaciones por separado.
Evalúe también todas las operaciones juntas.

## Entorno

Complete estos datos antes de interpretar los resultados.

| Dato | Valor |
| --- | --- |
| CPU | {{CPU}} |
| Memoria disponible | {{MEMORIA}} |
| Sistema operativo | {{SISTEMA_OPERATIVO}} |
| Versión de Node | {{VERSION_NODE}} |
| Versión de la aplicación | {{VERSION_APLICACION}} |
| Modo de ejecución: desarrollo o producción | {{MODO}} |
| Versión de PostgreSQL | {{VERSION_POSTGRESQL}} |
| Tamaño inicial de la base | {{TAMANO_BASE}} |
| Fecha UTC | {{FECHA_UTC}} |
| URL local | {{BASE}} |
| Duración solicitada y medida | {{DURACIONES}} |
| Sesiones iniciadas | {{SESIONES}} |

## Método

Distribuya las sesiones entre los usuarios de la siembra mediante rotación.
Obtenga una cookie independiente mediante login para cada sesión.
Lea las claves exclusivamente desde variables de entorno.
Envíe Origin con el origen indicado mediante `--base`.
Restrinja la URL base a localhost, 127.0.0.1 o ::1.

Compruebe las consultas disponibles antes de medir.
Considere las rutas de panel, clientes, cotizaciones, órdenes y producción.
Pruebe `/api/v1/inventario/materiales` y, como alternativa, `/api/v1/materiales`.
Descarte únicamente las consultas previas con estados 403 o 404.
Registre las comprobaciones previas dentro de `preparacion`.
Cancele la medición ante otros errores previos, incluidos 401 y 429.

Inicie todas las sesiones conjuntamente mediante promesas concurrentes.
Mantenga una petición pendiente por sesión.
Repita este ciclo durante la duración solicitada:

1. Ejecute siete consultas mediante rotación de rutas disponibles.
2. Cree dos clientes con nombre y RUC únicos mediante POST.
3. Actualice el último cliente creado mediante PATCH con su `version`.

Use el prefijo `RENDIMIENTO-` en nombre y RUC.
Conserve las versiones recibidas para posteriores mutaciones.
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
Exija cero errores 5xx durante la medición.
Exija muestras para los tres tipos.
Marque `NO EVALUABLE` ante errores de ejecución, sesiones faltantes, omisiones o creaciones inciertas.
Compruebe que la ejecución use 20 sesiones antes de validar RNF-01.

Revise también los errores HTTP y los errores de red.
Distinga una respuesta rápida de una operación completada correctamente.
El criterio temporal permite respuestas 4xx rápidas y contabiliza esos errores separadamente.
Las escrituras requieren permisos para gestionar clientes.
Los perfiles sin esos permisos pueden causar errores 403 y actualizaciones omitidas.
Revise esos casos antes de usar la ejecución como evidencia de la tesis.

## Resultados

Reemplace esta tabla con la tabla impresa por el script.

| Tipo | n | p50 (ms) | p95 (ms) | p99 (ms) | Máximo (ms) | ≤ 2000 ms (%) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Consulta | {{N_CONSULTA}} | {{P50_CONSULTA}} | {{P95_CONSULTA}} | {{P99_CONSULTA}} | {{MAX_CONSULTA}} | {{PORCENTAJE_CONSULTA}} |
| Creación | {{N_CREACION}} | {{P50_CREACION}} | {{P95_CREACION}} | {{P99_CREACION}} | {{MAX_CREACION}} | {{PORCENTAJE_CREACION}} |
| Actualización | {{N_ACTUALIZACION}} | {{P50_ACTUALIZACION}} | {{P95_ACTUALIZACION}} | {{P99_ACTUALIZACION}} | {{MAX_ACTUALIZACION}} | {{PORCENTAJE_ACTUALIZACION}} |
| Global | {{N_GLOBAL}} | {{P50_GLOBAL}} | {{P95_GLOBAL}} | {{P99_GLOBAL}} | {{MAX_GLOBAL}} | {{PORCENTAJE_GLOBAL}} |

| Dato adicional | Valor |
| --- | --- |
| Decisión | {{DECISION}} |
| Mezcla observada | {{MEZCLA_OBSERVADA}} |
| Errores HTTP por estado | {{ERRORES_HTTP}} |
| Errores 5xx | {{ERRORES_5XX}} |
| Errores de red | {{ERRORES_RED}} |
| Operaciones omitidas | {{OMITIDAS}} |
| Creaciones inciertas | {{CREACIONES_INCIERTAS}} |
| Clientes archivados y pendientes | {{LIMPIEZA}} |
| Archivo JSON | {{ARCHIVO_JSON}} |

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
