# TRACORE

Plataforma web de gestión para Soluciones Creativas (Estelí, Nicaragua).
Es el piloto de la tesis PCE de la UAM.
Integra clientes, cotizaciones, órdenes de trabajo, inventario, producción y trazabilidad.

## Módulos

| Módulo | Qué hace |
|---|---|
| Clientes | Registra y consulta clientes con su historial. |
| Catálogo y cotizaciones | Cotiza productos de catálogo y trabajos personalizados con costos variables. |
| Órdenes de trabajo | Convierte una cotización aprobada en orden sin volver a digitar. |
| Inventario | Controla existencias, entradas, consumos y devoluciones por orden. |
| Producción | Asigna responsables y fechas por etapa y controla el avance. |
| Trazabilidad | Conserva el historial de cambios y responsables de cada trabajo. |
| Panel y reportes | Muestra cotizaciones pendientes, materiales y carga de trabajo. Exporta CSV. |

## Tecnologías

- Next.js 16, React 19 y TypeScript.
- Tailwind 4 y shadcn/ui.
- Prisma 7 y PostgreSQL 17.
- Docker Compose.
- Vitest, Playwright y axe-core.
- pnpm 11 y Node 24.

## Clonar

El repositorio es privado. Inicia sesión en GitHub con tu cuenta antes de clonar.

```sh
git clone https://github.com/NormanSMA/Tesis-SC.git
cd Tesis-SC
```

## Arranque

Necesitas Docker con Docker Compose v2.
No hace falta crear `.env`: Compose lee los valores base de `.env.example`.

```sh
docker compose up -d --build
```

Abre http://127.0.0.1:3000.
Comprueba el estado en http://127.0.0.1:3000/api/v1/salud.

El comando levanta la base de datos, aplica las migraciones, carga datos de demostración e inicia la aplicación.
También inicia el servicio `respaldo` con `docker compose up -d`, sin perfil adicional.
El servicio respalda al arrancar y cada 23 horas por defecto. Así RNF-06 (un respaldo exitoso cada 24 horas) se cumple aunque el respaldo tarde.
Consulte el registro mediante `docker compose exec respaldo cat /respaldos/registro.log`.

## Usuarios de prueba

Las contraseñas están en `.env.example`.

| Perfil | Correo | Variable de la clave |
|---|---|---|
| Gerencia | gerardo.jimenez@solucionescreativas.test | `SEED_PASSWORD_GERENCIA` |
| Atención al cliente | valentina.castro@solucionescreativas.test | `SEED_PASSWORD_ATENCION_CLIENTE` |
| Operaciones | karla.reyes@solucionescreativas.test | `SEED_PASSWORD_OPERACIONES` |
| Administración | luis.mendoza@solucionescreativas.test | `SEED_PASSWORD_ADMINISTRACION` |
| Producción | marco.lopez@solucionescreativas.test | `SEED_PASSWORD_PRODUCCION` |
| Administración técnica | roberto.diaz@solucionescreativas.test | `SEED_PASSWORD_ADMIN` |

La matriz vigente contiene seis perfiles, 30 permisos y 62 concesiones.
El conteo procede de `PERMISOS_POR_PERFIL` en `src/core/permisos.ts`.
Un usuario puede tener varios perfiles; sus permisos efectivos forman una unión.
Consulte [la matriz v9](docs/modulos/09-perfiles-v9.md) y [la siembra](docs/seed.md).

## Pruebas

Necesitas Node 24 y pnpm.

```sh
pnpm install
pnpm db:generate
pnpm typecheck
pnpm lint
docker compose --profile test up -d db_test
TEST_DATABASE_URL=postgresql://sc_owner:<clave>@127.0.0.1:5443/<nombre>_test?schema=public pnpm test
pnpm e2e
```

La base de pruebas debe terminar en `_test`. La suite borra su contenido.

## Integración continua

GitHub Actions ejecuta `.github/workflows/ci.yml` en cada `push` y `pull_request`.
Usa Node 24 y la versión de pnpm indicada por `packageManager` en `package.json`.
Carga `.env.example` con valores ficticios y dirige `TEST_DATABASE_URL` al servicio PostgreSQL 17.
Instala con `pnpm install --frozen-lockfile` y ejecuta `pnpm db:generate`.
Ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
La suite prepara las migraciones y los permisos en la base desechable `sc_test`.
Los E2E requieren navegadores y una aplicación con siembra; quedan para un flujo separado.

## Parar y limpiar

```sh
docker compose stop        # conserva los datos
docker compose down -v     # elimina contenedores y datos
```

## Documentación

- `docs/trazabilidad.md`: criterios de aceptación y su estado.
- `docs/analisis/`: análisis de la tesis y modelo de datos.
- `docs/modulos/`: diseño de cada módulo.
- `docs/decisiones.md` y `docs/supuestos.md`: decisiones y supuestos.
- `AGENTS.md`: convenciones de código.
