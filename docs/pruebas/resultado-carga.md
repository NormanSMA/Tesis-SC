# Resultado de las pruebas de carga (2026-10-19)

Corrida con `sh scripts/carga/correr.sh --reiniciar-base` y repeticiones de `concurrencia` y `pico concurrencia`.
Entorno: portátil con Windows 11 y Docker Desktop; una instancia de la app (`app_carga`, 127.0.0.1:3100) y PostgreSQL 17 en contenedores.
Límites de tasa con los valores de producción. Cómo correrlo: [carga.md](carga.md).

## Datos

1000 usuarios en los 6 perfiles, 2024 clientes, 340 materiales, 20 033 cotizaciones, 1013 órdenes con etapas, 20 072 movimientos y 35 471 eventos de bitácora.

## Resultados

| Escenario | Usuarios | Peticiones | p95 (k6) | Errores 5xx | Fallos de red | Umbral |
|---|---|---|---|---|---|---|
| Resistencia (10 min) | 100 | 62 683 | 828 ms | 0 | 0 | Cumple |
| Lectura mixta (5 min) | 200 | 22 917 | 2,89 s | 0 | 0 | No cumple p95 < 2 s |
| Pico (0 a 1000 en 60 s) | 1000 | 12 267 | 15,49 s | 0 | 14 (0,11 %) | No cumple p95 < 2 s |
| Concurrencia (3 corridas aisladas) | 90 | 546 por corrida | menos de 1 s | 0 | 0 | Cumple, 100 % de comprobaciones |
| Concurrencia tras el pico | 90 | 546 | — | 0 | 1 | 99,8 % de comprobaciones |

Integridad después de cada escenario: todas las revisiones correctas (17 de 17 en concurrencia; 14 de 14 en los demás).
Ninguna existencia negativa, ninguna cotización con dos órdenes, una sola edición ganadora por cliente y bitácora completa.

## Lectura

- El sistema no se cae ni corrompe datos en ningún escenario: 0 errores 5xx y la integridad siempre pasa.
- Los "fallos de red" son respuestas con estado 0 (`dial: i/o timeout`): la conexión no llegó a la app porque se saturó el reenvío de puertos de Docker Desktop. No son errores de la aplicación.
- Con 200 usuarios activos o más, la latencia sube por cola. Dentro del servidor la mediana es 28 ms y el p95 181 ms (`/api/v1/sistema`), pero k6 mide 2,89 s de punta a punta.
  La diferencia es espera antes de entrar al manejador: una sola instancia de Node atiende todas las peticiones.
- La ruta más lenta dentro del servidor es `GET /api/v1/panel` (p95 790 ms con 200 usuarios).
- RNF-01 (20 sesiones, p95 2 s o menos) sigue cubierto con amplio margen: 100 usuarios sostenidos dan p95 828 ms.

## Estado del sistema frente a k6

| Métrica | k6 (cliente) | Estado del sistema (servidor) |
|---|---|---|
| p95 en resistencia | 828,3 ms | 689,9 ms |
| Tasa de 5xx | 0 % | 0 % |
| Tasa de 4xx | 0 % | 0 % |

El panel coincide en errores y en tendencia. Su p95 es menor porque mide dentro del proceso y sin la red, y promedia las últimas 500 peticiones.

## Mejoras posibles (no aplicadas)

1. Varias instancias de la app detrás del proxy (réplicas en Compose o modo clúster) para repartir la cola.
2. Caché corta del panel por perfil (por ejemplo 15 s) o consultas agregadas más ligeras.
3. Mostrar en el Estado del sistema que la latencia es "dentro del servidor" y no incluye la espera en cola.
