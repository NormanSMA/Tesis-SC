# SC Plataforma

Plataforma web para Soluciones Creativas (Managua). Es el piloto de la tesis PCE de la UAM.
Integra clientes, cotización, orden de trabajo, inventario, producción y trazabilidad.

Stack: Next.js 16, TypeScript, Prisma 7.10.0, PostgreSQL 17 y Docker Compose.
Las convenciones de código están en `AGENTS.md`. El modelo de datos está en `docs/analisis/05-modelo-datos.md`.

## Requisitos

- Docker con Docker Compose v2. Es lo único que necesitas para ejecutar la plataforma.
- Node 24 y pnpm 11 solo para desarrollo y pruebas fuera de Docker.

## Arranque

```sh
docker compose up --build
```

Este comando no necesita pasos previos. Ejecuta tres servicios en orden:

1. `db` inicia PostgreSQL 17 con un volumen con nombre.
2. `migrate` aplica las migraciones, crea el rol `sc_app` y carga los datos iniciales.
3. `app` inicia la plataforma cuando `migrate` termina bien.

Abre la aplicación en http://127.0.0.1:3000.
Comprueba el estado en http://127.0.0.1:3000/api/v1/salud.
Agrega `-d` para ejecutar en segundo plano.

Todos los puertos escuchan solo en 127.0.0.1.

| Servicio | Puerto en tu máquina | Variable |
|---|---|---|
| app | 3000 | `APP_PORT` |
| db | 5442 | `DB_PORT` |
| db_test (perfil test) | 5443 | fijo |

## Parar y limpiar

```sh
docker compose stop          # detiene y conserva los datos
docker compose down          # elimina los contenedores y conserva los datos
docker compose down -v       # elimina contenedores y datos
docker compose --profile test down -v   # incluye la base de pruebas
```

## Credenciales y variables

`compose.yaml` lee `.env.example` y después `.env`, si existe.
Copia `.env.example` a `.env` para cambiar un valor.
Los valores de `.env.example` son de ejemplo. Cámbialos antes de cualquier uso real.
Las credenciales viven solo en esos archivos.

La base usa dos roles:

- `sc_owner` es el dueño de las tablas. Solo migra.
- `sc_app` es el rol de la aplicación. No es superusuario ni dueño de las tablas.

Los triggers de la base no protegen contra el dueño (ADR-009).
Por eso la aplicación nunca usa `sc_owner`.
`sc_app` además pierde UPDATE, DELETE y TRUNCATE sobre `bitacora`, `movimiento_inventario` y `consumo_orden`.

## Pruebas

Instala dependencias y genera el cliente de Prisma:

```sh
pnpm install
pnpm db:generate
```

Levanta la base de pruebas y ejecuta todo:

```sh
docker compose --profile test up -d db_test
pnpm test
```

`pnpm test` ejecuta las pruebas unitarias y las de integración.
En cada corrida, `tests/helpers/global-setup.ts` recrea el esquema de `sc_test`.
Después aplica las migraciones y crea el rol `sc_app`.
Las pruebas de integración usan dos clientes: `sc_owner` para preparar datos y `sc_app` para probar permisos reales.

Si `db_test` no responde, las pruebas de integración se omiten con un aviso.
Si la variable `CI` está definida, la corrida falla en lugar de omitirlas.

No ejecutes dos corridas de pruebas a la vez. Comparten la misma base y se borran entre sí.

Otros comandos:

```sh
pnpm typecheck
pnpm lint
pnpm build
```

## Migraciones

El esquema vive en `prisma/schema.prisma`.
Los CHECK, triggers y funciones viven en `prisma/sql/restricciones.sql`.
Cada migración contiene el SQL de Prisma. Al final lleva `restricciones.sql` sin BEGIN ni COMMIT.
Ese archivo es idempotente, así que repetirlo en cada migración es seguro.

Para crear una migración nueva:

1. Edita `schema.prisma` o `restricciones.sql`.
2. Lleva la base de desarrollo a la última migración: `docker compose run --rm migrate`.
3. Genera la migración: `node scripts/db/generar-migracion.mjs <nombre_en_minusculas>`.
4. Revisa el archivo creado en `prisma/migrations/`.
5. Aplícala con el mismo comando: `docker compose run --rm migrate`.

Opciones del generador:

- `--sin-restricciones` omite `restricciones.sql`.
- `--desde-vacio` compara contra una base vacía. Solo sirve para la migración inicial.

El generador necesita `DATABASE_URL_MIGRACION` en `.env` apuntando a la base de desarrollo.

Verifica que no haya deriva entre la base y el esquema:

```sh
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

La salida correcta es `-- This is an empty migration.`

`prisma/migrations/` se versiona. No edites una migración ya aplicada.

## Roles de la base

`scripts/db/roles.sh` crea o actualiza `sc_app`. Se ejecuta después de cada migración.
Es idempotente. El servicio `migrate` lo ejecuta por ti.
Usa `scripts/db/roles.sql`, que también usan las pruebas.

## Respaldo y restauración

Requieren el servicio `db` en marcha.

```sh
sh scripts/respaldo.sh                # crea respaldos/sc-plataforma-AAAAMMDD-HHMMSS.dump
sh scripts/respaldo.sh ruta/carpeta   # usa otra carpeta
sh scripts/restaurar.sh respaldos/<archivo>.dump --confirmar
```

El respaldo usa `pg_dump` en formato custom.
La restauración reemplaza los datos actuales.
Detiene la aplicación, restaura, reaplica los permisos de `sc_app` y reinicia la aplicación.
Guarda los respaldos fuera del repositorio.

## Estructura de infraestructura

| Ruta | Contenido |
|---|---|
| `Dockerfile` | Etapas `deps`, `build`, `tools` y `runner` sobre Node 24. |
| `compose.yaml` | Servicios `db`, `migrate`, `app` y `db_test`. |
| `scripts/db/` | Generador de migraciones, roles y preparación de la base. |
| `scripts/docker/entrypoint.sh` | Arma las URL de conexión dentro del contenedor. |
| `scripts/respaldo.sh`, `scripts/restaurar.sh` | Respaldo y restauración. |
| `tests/helpers/` | Preparación de la base de pruebas y clientes. |
