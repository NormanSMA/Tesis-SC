#!/usr/bin/env node
// Reparte las pruebas por secciones para no correrlas todas de golpe.
// Uso:
//   node scripts/pruebas/secciones.mjs --lista                  secciones y cuántos archivos tiene cada una
//   node scripts/pruebas/secciones.mjs <seccion>                pruebas unitarias y de integración de la sección
//   node scripts/pruebas/secciones.mjs --todas                  todas las secciones, una tras otra, con resumen
//   node scripts/pruebas/secciones.mjs --cambios                solo lo afectado por los cambios sin comitear (vitest --changed)
//   node scripts/pruebas/secciones.mjs --verificar              falla si algún archivo de prueba no pertenece a una sección
//   node scripts/pruebas/secciones.mjs --e2e <seccion> [--anchos]   E2E de la sección (solo portátil; --anchos = los 4 anchos)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);

// Prefijo de archivo = nombre antes del primer guion. Cada archivo cae en una sola sección.
export const SECCIONES = {
  nucleo: {
    descripcion: "reglas puras, errores, cabeceras, siembra, transiciones y concurrencia cruzada",
    unit: ["costeo", "permisos", "autorizacion", "errores", "http", "limites", "cabeceras", "api", "diseno", "rendimiento", "seed", "respaldo", "secciones"],
    integracion: ["costeo", "errores", "transiciones", "seed", "salud", "roles", "dto", "concurrencia"],
    e2e: ["base", "diseno"],
  },
  acceso: {
    descripcion: "autenticación, sesión, clave temporal, usuarios, permisos y configuración",
    unit: ["admin", "auth", "cambiar"],
    integracion: ["admin", "auth"],
    e2e: ["admin"],
  },
  clientes: {
    descripcion: "clientes y su ficha",
    unit: ["clientes", "cliente"], integracion: ["clientes", "cliente"], e2e: ["clientes"],
  },
  catalogo: {
    descripcion: "catálogo, recetas, categorías y plantillas",
    unit: ["catalogo"], integracion: ["catalogo"], e2e: ["catalogo", "produccion-catalogos"],
  },
  cotizaciones: {
    descripcion: "cotizaciones, costeo de líneas y estados",
    unit: ["cotizaciones"], integracion: ["cotizaciones"], e2e: ["cotizaciones"],
  },
  ordenes: {
    descripcion: "órdenes de trabajo, conversión y cancelación",
    unit: ["ordenes"], integracion: ["ordenes"], e2e: ["ordenes"],
  },
  produccion: {
    descripcion: "etapas, tablero, áreas y retrabajo",
    unit: ["produccion"], integracion: ["produccion"], e2e: ["produccion"],
  },
  inventario: {
    descripcion: "materiales, libro, consumos, devoluciones e idempotencia",
    unit: ["inventario", "consumo"], integracion: ["inventario"], e2e: ["inventario", "inventario-orden"],
  },
  analitica: {
    descripcion: "trazabilidad, panel y reportes",
    unit: ["trazabilidad", "panel", "reportes"], integracion: ["trazabilidad", "panel", "reportes"], e2e: ["panel", "trazabilidad"],
  },
  interfaz: {
    descripcion: "pruebas de componentes con navegador (Edge), las más lentas",
    unit: [], integracion: [], e2e: ["auditoria-frontend"],
  },
};

const prefijo = (archivo) => archivo.replace(/\.test\.ts$|\.spec\.ts$/, "").split("-")[0];
const lista = (carpeta, sufijo) => readdirSync(path.join(raiz, carpeta)).filter((f) => f.endsWith(sufijo)).sort();

function esInterfaz(archivo) {
  return archivo.endsWith("-interfaz.test.ts");
}

export function seccionDe(carpeta, archivo) {
  if (carpeta === "unit" && esInterfaz(archivo)) return "interfaz";
  const clave = carpeta === "unit" ? "unit" : "integracion";
  const p = prefijo(archivo);
  const duenas = Object.entries(SECCIONES).filter(([, s]) => s[clave].includes(p)).map(([nombre]) => nombre);
  return duenas.length === 1 ? duenas[0] : duenas.length === 0 ? null : duenas;
}

export function archivosDeSeccion(nombre) {
  const salida = [];
  for (const [carpeta, dir] of [["unit", "tests/unit"], ["integracion", "tests/integration"]]) {
    for (const archivo of lista(dir, ".test.ts")) {
      if (seccionDe(carpeta === "unit" ? "unit" : "integracion", archivo) === nombre) salida.push(`${dir}/${archivo}`);
    }
  }
  return salida;
}

function verificar() {
  const problemas = [];
  for (const [carpeta, dir] of [["unit", "tests/unit"], ["integracion", "tests/integration"]]) {
    for (const archivo of lista(dir, ".test.ts")) {
      const dueno = seccionDe(carpeta, archivo);
      if (dueno === null) problemas.push(`${dir}/${archivo}: sin sección (agregue el prefijo "${prefijo(archivo)}" en SECCIONES)`);
      else if (Array.isArray(dueno)) problemas.push(`${dir}/${archivo}: en varias secciones (${dueno.join(", ")})`);
    }
  }
  for (const archivo of lista("e2e", ".spec.ts")) {
    const nombre = archivo.replace(/\.spec\.ts$/, "");
    if (nombre === "regresion-visual") continue; // corre solo dentro de Docker (scripts/auditoria/visual-docker.sh)
    if (!Object.values(SECCIONES).some((s) => s.e2e.includes(nombre))) problemas.push(`e2e/${archivo}: sin sección E2E`);
  }
  return problemas;
}

function cargarEntornoEjemplo() {
  const ruta = path.join(raiz, ".env.example");
  const base = existsSync(ruta) ? parseEnv(readFileSync(ruta, "utf8")) : {};
  return { ...base, ...process.env };
}

function urlBase(nombreBase, entorno) {
  const dada = entorno.TEST_DATABASE_URL;
  const origen = dada ? new URL(dada) : new URL("postgresql://sc_owner:cambiar-en-produccion@127.0.0.1:5443/postgres");
  const url = new URL(origen);
  url.pathname = `/${nombreBase}`;
  url.search = "?schema=public";
  return url.toString();
}

async function asegurarBase(url) {
  const { Client } = require("pg");
  const destino = new URL(url);
  const nombre = destino.pathname.slice(1);
  if (!nombre.endsWith("_test")) throw new Error(`La base "${nombre}" no termina en _test.`);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const cliente = new Client({ connectionString: admin.toString() });
  await cliente.connect();
  try {
    const { rowCount } = await cliente.query("SELECT 1 FROM pg_database WHERE datname = $1", [nombre]);
    if (!rowCount) await cliente.query(`CREATE DATABASE "${nombre}"`);
  } finally {
    await cliente.end();
  }
}

function correr(comando, args, entorno) {
  const resultado = spawnSync(comando, args, { cwd: raiz, env: entorno, stdio: "inherit", shell: process.platform === "win32" });
  return resultado.status ?? 1;
}

async function correrVitest(nombre, extra, entorno) {
  const url = urlBase(`seccion_${nombre}_test`, entorno);
  await asegurarBase(url);
  return correr("pnpm", ["exec", "vitest", "run", ...extra], { ...entorno, TEST_DATABASE_URL: url });
}

async function correrSeccion(nombre) {
  const archivos = archivosDeSeccion(nombre);
  if (!archivos.length) {
    console.log(`La sección "${nombre}" no tiene archivos vitest.`);
    return 0;
  }
  console.log(`\n== Sección ${nombre}: ${archivos.length} archivos (${SECCIONES[nombre].descripcion})`);
  const entorno = cargarEntornoEjemplo();
  return correrVitest(nombre, archivos, entorno);
}

async function correrInterfaz() {
  const archivos = lista("tests/unit", "-interfaz.test.ts").map((f) => `tests/unit/${f}`);
  console.log(`\n== Sección interfaz: ${archivos.length} archivos con navegador`);
  return correrVitest("interfaz", archivos, cargarEntornoEjemplo());
}

function correrE2e(nombre, anchos) {
  const seccion = SECCIONES[nombre];
  if (!seccion?.e2e.length) throw new Error(`La sección "${nombre}" no tiene E2E.`);
  const candado = path.join(raiz, ".dev-lock");
  if (existsSync(candado)) throw new Error("Existe .dev-lock: otro proceso usa el servidor local.");
  mkdirSync(candado);
  try {
    const specs = seccion.e2e.map((s) => `e2e/${s}.spec.ts`);
    const proyectos = anchos ? [] : ["--project=portatil"];
    console.log(`\n== E2E ${nombre}: ${specs.join(", ")} ${anchos ? "(4 anchos)" : "(portátil)"}`);
    return correr("pnpm", ["exec", "playwright", "test", "--reporter=list", ...proyectos, ...specs], cargarEntornoEjemplo());
  } finally {
    rmSync(candado, { recursive: true, force: true });
  }
}

async function principal() {
  const args = process.argv.slice(2);
  const [primero] = args;
  if (!primero || primero === "--lista") {
    const problemas = verificar();
    for (const nombre of Object.keys(SECCIONES)) {
      const n = nombre === "interfaz" ? lista("tests/unit", "-interfaz.test.ts").length : archivosDeSeccion(nombre).length;
      console.log(`${nombre.padEnd(14)} ${String(n).padStart(3)} archivos  ${SECCIONES[nombre].descripcion}`);
    }
    if (problemas.length) console.log(`\nAviso: ${problemas.length} archivos sin sección. Corra --verificar.`);
    return 0;
  }
  if (primero === "--verificar") {
    const problemas = verificar();
    problemas.forEach((p) => console.error(p));
    console.log(problemas.length ? `${problemas.length} problemas` : "Todos los archivos de prueba pertenecen a una sección.");
    return problemas.length ? 1 : 0;
  }
  if (primero === "--cambios") {
    console.log("== Solo lo afectado por los cambios sin comitear");
    return correrVitest("cambios", ["--changed"], cargarEntornoEjemplo());
  }
  if (primero === "--e2e") {
    const nombre = args[1];
    if (!nombre) throw new Error("Indique la sección: --e2e <seccion> [--anchos]");
    return correrE2e(nombre, args.includes("--anchos"));
  }
  if (primero === "--todas") {
    const resumen = [];
    for (const nombre of Object.keys(SECCIONES)) {
      const inicio = Date.now();
      const estado = nombre === "interfaz" ? await correrInterfaz() : await correrSeccion(nombre);
      resumen.push({ nombre, estado, segundos: Math.round((Date.now() - inicio) / 1000) });
    }
    console.log("\n== Resumen por sección");
    for (const fila of resumen) console.log(`${fila.nombre.padEnd(14)} ${fila.estado === 0 ? "OK    " : "FALLA "} ${fila.segundos} s`);
    return resumen.some((fila) => fila.estado !== 0) ? 1 : 0;
  }
  if (!SECCIONES[primero]) throw new Error(`Sección desconocida "${primero}". Use --lista.`);
  return primero === "interfaz" ? correrInterfaz() : correrSeccion(primero);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().then((codigo) => process.exit(codigo), (error) => { console.error(error.message); process.exit(1); });
}
