// Bases de prueba clonadas desde una plantilla migrada (CREATE DATABASE ... TEMPLATE).
// La plantilla se reconstruye solo cuando cambia la huella del esquema; clonar tarda milisegundos.
// Lo usan tests/helpers/global-setup.ts y scripts/reiniciar-demo.mjs.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PLANTILLA_PRUEBAS = "sc_test_template";

function archivosDe(relativa) {
  const absoluta = path.join(raiz, relativa);
  if (!statSync(absoluta).isDirectory()) return [relativa];
  return readdirSync(absoluta).sort().flatMap((nombre) => archivosDe(path.join(relativa, nombre)));
}

/** SHA-256 de los archivos que definen una base: cualquier cambio obliga a reconstruir la plantilla. */
export function huella(rutas) {
  const hash = createHash("sha256");
  for (const archivo of rutas.flatMap(archivosDe)) {
    hash.update(archivo.replaceAll("\\", "/"));
    hash.update(readFileSync(path.join(raiz, archivo)));
  }
  return hash.digest("hex");
}

export const RUTAS_ESQUEMA = [
  "prisma/schema.prisma",
  "prisma/migrations",
  "prisma/sql/restricciones.sql",
  "scripts/db/roles.sql",
  "scripts/pruebas/plantilla-bd.mjs",
];

const ident = (nombre) => `"${nombre.replaceAll('"', '""')}"`;
const literal = (texto) => `'${texto.replaceAll("'", "''")}'`;

function urlConBase(url, nombre) {
  const nueva = new URL(url);
  nueva.pathname = `/${nombre}`;
  nueva.searchParams.delete("schema");
  return nueva.toString();
}

async function conectar(url) {
  const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
  await cliente.connect();
  return cliente;
}

async function leerHuella(admin, plantilla) {
  const { rows } = await admin.query(
    "SELECT shobj_description(oid, 'pg_database') AS huella FROM pg_database WHERE datname = $1",
    [plantilla],
  );
  return rows[0]?.huella ?? null;
}

async function reconstruir(admin, { url, plantilla, huellaNueva, migrar, aplicarRoles }) {
  const existe = (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [plantilla])).rowCount;
  if (existe) await admin.query(`ALTER DATABASE ${ident(plantilla)} WITH IS_TEMPLATE false`);
  await admin.query(`DROP DATABASE IF EXISTS ${ident(plantilla)} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${ident(plantilla)}`);
  const urlPlantilla = urlConBase(url, plantilla);
  await migrar(`${urlPlantilla}${urlPlantilla.includes("?") ? "&" : "?"}schema=public`);
  if (aplicarRoles) {
    const cliente = await conectar(urlPlantilla);
    try {
      await aplicarRoles(cliente);
    } finally {
      await cliente.end();
    }
  }
  await admin.query(`COMMENT ON DATABASE ${ident(plantilla)} IS ${literal(huellaNueva)}`);
  // Sin conexiones abiertas: CREATE DATABASE ... TEMPLATE falla si alguien está conectado al origen.
  await admin.query(`ALTER DATABASE ${ident(plantilla)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`);
}

/**
 * Deja la base de `url` como copia recién clonada de la plantilla.
 * Un candado de sesión evita que dos trabajadores reconstruyan la plantilla a la vez.
 */
export async function clonarDesdePlantilla({ url, migrar, aplicarRoles, rolApp, plantilla = PLANTILLA_PRUEBAS }) {
  const destino = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!destino.endsWith("_test")) throw new Error(`Se niega a reemplazar "${destino}": no termina en _test.`);
  const admin = await conectar(urlConBase(url, "postgres"));
  const inicio = Date.now();
  try {
    await admin.query("SELECT pg_advisory_lock(hashtext($1))", [plantilla]);
    const huellaNueva = huella(RUTAS_ESQUEMA);
    const reconstruida = (await leerHuella(admin, plantilla)) !== huellaNueva;
    if (reconstruida) await reconstruir(admin, { url, plantilla, huellaNueva, migrar, aplicarRoles });
    await admin.query(`DROP DATABASE IF EXISTS ${ident(destino)} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${ident(destino)} TEMPLATE ${ident(plantilla)}`);
    // CONNECT vive en pg_database: la copia no lo hereda de la plantilla.
    if (rolApp) await admin.query(`GRANT CONNECT ON DATABASE ${ident(destino)} TO ${ident(rolApp)}`);
    return { reconstruida, milisegundos: Date.now() - inicio };
  } finally {
    await admin.query("SELECT pg_advisory_unlock(hashtext($1))", [plantilla]).catch(() => {});
    await admin.end();
  }
}
