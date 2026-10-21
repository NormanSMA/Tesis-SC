#!/usr/bin/env node
// Devuelve la base de demostración al estado de la siembra. Úsalo tras correr E2E o rendimiento contra la aplicación:
// esas pruebas crean clientes, cotizaciones y órdenes reales en la base (por ejemplo RENDIMIENTO-...).
// No borra el volumen de respaldos. Uso: pnpm demo:reiniciar [--completo]
//
// Ruta rápida: clona la base desde sc_demo_template (CREATE DATABASE ... TEMPLATE) y reinicia app.
// Ruta completa: recrea el volumen, migra, siembra y guarda una plantilla nueva. Corre si se pide con --completo,
// si no hay plantilla o si cambió su huella. La huella incluye la fecha de Managua porque la siembra usa
// fechas relativas a hoy: la plantilla de ayer mostraría datos envejecidos.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { huella, RUTAS_ESQUEMA } from "./pruebas/plantilla-bd.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLANTILLA = "sc_demo_template";
const completo = process.argv.includes("--completo");

function leerEntorno() {
  const leer = (archivo) => (existsSync(path.join(raiz, archivo)) ? parseEnv(readFileSync(path.join(raiz, archivo), "utf8")) : {});
  return { ...leer(".env.example"), ...leer(".env"), ...process.env };
}
const entorno = leerEntorno();
const base = entorno.POSTGRES_DB;
const dueno = entorno.POSTGRES_USER;
const rolApp = entorno.APP_DB_USER ?? "sc_app";
const ident = (nombre) => `"${nombre.replaceAll('"', '""')}"`;

// Sin shell: el SQL lleva comillas y espacios que cmd.exe rompería.
function docker(argumentos, { salir = true, silencioso = false } = {}) {
  if (!silencioso) console.log(`> docker ${argumentos.join(" ")}`);
  const r = spawnSync("docker", argumentos, { cwd: raiz, encoding: "utf8", stdio: silencioso ? "pipe" : "inherit" });
  if (r.status !== 0 && salir) {
    console.error(`Falló: docker ${argumentos.join(" ")}\n${r.stderr ?? ""}`);
    process.exit(r.status ?? 1);
  }
  return { estado: r.status ?? 1, texto: `${r.stdout ?? ""}`.trim() };
}

// Cada -c corre en su propia transacción: DROP y CREATE DATABASE no admiten un bloque de transacción.
function psql(sentencias, opciones = {}) {
  const argumentos = ["compose", "exec", "-T", "db", "psql", "-U", dueno, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"];
  for (const s of sentencias) argumentos.push("-c", s);
  return docker(argumentos, { silencioso: true, ...opciones });
}

function huellaDemo() {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
  return `${huella([...RUTAS_ESQUEMA, "prisma/seed"])}:${hoy}`;
}

function huellaGuardada() {
  const { estado, texto } = psql(
    [`SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '${PLANTILLA}'`],
    { salir: false },
  );
  return estado === 0 ? texto : null;
}

function cerrarConexiones(nombre) {
  return `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${nombre}' AND pid <> pg_backend_pid()`;
}

// Espera a que app responda sano. No usa "compose up": relanzaría migrate, que vuelve a sembrar.
function esperarApp(segundosMax = 90) {
  const id = docker(["compose", "ps", "-q", "app"], { silencioso: true }).texto;
  for (let i = 0; i < segundosMax; i++) {
    const { texto } = docker(["inspect", "-f", "{{.State.Health.Status}}", id], { silencioso: true, salir: false });
    if (texto === "healthy") return;
    spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 1000)"]);
  }
  console.error(`app no quedó sana en ${segundosMax} s. Revise: docker compose logs app`);
  process.exit(1);
}

function rutaRapida() {
  const inicio = Date.now();
  const { texto } = psql([
    "\\timing on",
    `DROP DATABASE IF EXISTS ${ident(base)} WITH (FORCE)`,
    `CREATE DATABASE ${ident(base)} TEMPLATE ${PLANTILLA} OWNER ${ident(dueno)}`,
    // CONNECT vive en pg_database: la copia no lo hereda de la plantilla.
    `GRANT CONNECT ON DATABASE ${ident(base)} TO ${ident(rolApp)}`,
  ]);
  const clon = texto.split("\n").filter((l) => l.startsWith("Time:"))[1] ?? "";
  console.log(`Base clonada de ${PLANTILLA} (${clon.replace("Time: ", "") || `${Date.now() - inicio} ms`}).`);
  docker(["compose", "restart", "app"]);
}

function guardarPlantilla(huellaNueva) {
  docker(["compose", "stop", "app"]);
  psql([
    `ALTER DATABASE ${PLANTILLA} WITH IS_TEMPLATE false`,
  ], { salir: false });
  psql([
    `DROP DATABASE IF EXISTS ${PLANTILLA} WITH (FORCE)`,
    // CREATE DATABASE ... TEMPLATE falla si queda alguna sesión abierta en el origen.
    cerrarConexiones(base),
    `CREATE DATABASE ${PLANTILLA} TEMPLATE ${ident(base)}`,
    `COMMENT ON DATABASE ${PLANTILLA} IS '${huellaNueva}'`,
    `ALTER DATABASE ${PLANTILLA} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`,
  ]);
  docker(["compose", "start", "app"]);
  console.log(`Plantilla ${PLANTILLA} guardada para la próxima vez.`);
}

function rutaCompleta(huellaNueva) {
  docker(["compose", "rm", "-sfv", "app", "migrate", "db"]);
  const volumen = docker(["volume", "rm", "sc-plataforma_sc_pgdata"], { salir: false });
  if (volumen.estado !== 0) console.warn("No se pudo borrar el volumen de datos; revise si el nombre cambió (docker volume ls).");
  // app depende de migrate: cuando up termina, la base ya está migrada y sembrada.
  docker(["compose", "up", "-d", "--build", "app"]);
  guardarPlantilla(huellaNueva);
}

const inicio = Date.now();
const huellaNueva = huellaDemo();
const vigente = !completo && huellaGuardada() === huellaNueva;
if (vigente) {
  rutaRapida();
} else {
  console.log(completo ? "Reinicio completo pedido." : "Sin plantilla vigente: se recrea la base con la siembra.");
  rutaCompleta(huellaNueva);
}
esperarApp();
console.log(`Base de demostración reiniciada con la siembra limpia en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
