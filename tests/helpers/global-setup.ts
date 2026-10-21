import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { clonarDesdePlantilla } from "../../scripts/pruebas/plantilla-bd.mjs";
import { nombreBaseDeDatos, urlParaPg, urlPropietario } from "./entorno-bd";

declare module "vitest" {
  export interface ProvidedContext {
    baseDisponible: boolean;
  }
}

const raiz = path.resolve(import.meta.dirname, "..", "..");

async function intentarConectar(url: string): Promise<Client | string> {
  const cliente = new Client({ connectionString: urlParaPg(url), connectionTimeoutMillis: 3_000 });
  try {
    await cliente.connect();
    return cliente;
  } catch (e) {
    return e instanceof Error ? e.message || e.name : String(e);
  }
}

// La suite borra el esquema completo: solo debe correr contra una base desechable.
function exigirBaseDeTest(url: string) {
  const nombre = nombreBaseDeDatos(url);
  if (!nombre.endsWith("_test")) {
    throw new Error(`TEST_DATABASE_URL apunta a "${nombre}". Se niega a borrar una base que no termina en _test.`);
  }
}

function migrar(url: string) {
  const resultado = spawnSync("pnpm exec prisma migrate deploy", {
    cwd: raiz,
    env: { ...process.env, DATABASE_URL_MIGRACION: url },
    encoding: "utf8",
    shell: true,
  });
  if (resultado.status !== 0) {
    throw new Error(`prisma migrate deploy fallo:\n${resultado.stdout}\n${resultado.stderr}`);
  }
}

// Usa el mismo SQL que scripts/db/roles.sh para que las pruebas vean los permisos reales.
async function crearRolDeLaAplicacion(cliente: Client) {
  const clave = process.env.APP_DB_PASSWORD;
  if (!clave) throw new Error("Falta APP_DB_PASSWORD. Revisa .env.example.");
  await cliente.query("SELECT set_config('sc.rol', $1, false), set_config('sc.clave', $2, false)", [
    process.env.APP_DB_USER ?? "sc_app",
    clave,
  ]);
  await cliente.query(readFileSync(path.join(raiz, "scripts", "db", "roles.sql"), "utf8"));
}

function urlAdministracion(url: string): string {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  return admin.toString();
}

// Ruta antigua: borra el esquema y aplica todas las migraciones. Solo con SC_SIN_PLANTILLA=1.
async function prepararSinPlantilla(url: string, conexion: Client) {
  await conexion.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  migrar(url);
  await crearRolDeLaAplicacion(conexion);
}

export default async function setup(project: TestProject) {
  const url = urlPropietario();
  const sinPlantilla = process.env.SC_SIN_PLANTILLA === "1";
  // Con plantilla, la base destino puede no existir todavia: se comprueba el servidor en la base postgres.
  const conexion = await intentarConectar(sinPlantilla ? url : urlAdministracion(url));

  if (typeof conexion === "string") {
    const aviso = `La base de pruebas no responde (${conexion}). Levanta: docker compose --profile test up -d db_test`;
    // Omitir en silencio daria una suite verde sin probar la base: solo se omite si se pide de forma explicita.
    if (process.env.OMITIR_INTEGRACION !== "1") {
      throw new Error(`${aviso}. Para omitir la integracion a conciencia usa OMITIR_INTEGRACION=1.`);
    }
    console.warn(`\n[integracion] ${aviso}\n[integracion] Las pruebas de integracion se omiten por OMITIR_INTEGRACION=1.\n`);
    project.provide("baseDisponible", false);
    return;
  }

  try {
    exigirBaseDeTest(url);
    if (sinPlantilla) {
      await prepararSinPlantilla(url, conexion);
    } else {
      const { reconstruida, milisegundos } = await clonarDesdePlantilla({
        url: urlParaPg(url),
        migrar,
        aplicarRoles: crearRolDeLaAplicacion,
        rolApp: process.env.APP_DB_USER ?? "sc_app",
      });
      console.warn(`[integracion] Base clonada de la plantilla en ${milisegundos} ms${reconstruida ? " (plantilla reconstruida)" : ""}.`);
    }
  } finally {
    await conexion.end();
  }
  project.provide("baseDisponible", true);
}
