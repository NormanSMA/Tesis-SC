#!/usr/bin/env node
// Reproduce en esta máquina los pasos de .github/workflows/ci.yml y auditoria.yml antes de subir cambios.
// Uso: node scripts/ci-local.mjs [--sin-build] [--sin-pruebas] [--paralelo N] [--solo <verificar|auditoria|pruebas>]
// Necesita Docker solo para gitleaks y Squawk (imágenes ya descargadas). No hace push ni cambia git.
// Como en GitHub, las pruebas corren a la vez que verificar y auditoria: cada sección clona su propia base.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const solo = args.includes("--solo") ? args[args.indexOf("--solo") + 1] : null;
const incluye = (grupo) => !solo || solo === grupo;
const SECCIONES_CI = ["nucleo", "acceso", "clientes", "catalogo", "cotizaciones", "ordenes", "produccion", "inventario", "analitica"];
const DOCKER_SIN_RUTAS = { env: { ...process.env, MSYS_NO_PATHCONV: "1" } };

// Asíncrono: los pasos de verificar y auditoria avanzan mientras las secciones de pruebas corren.
function ejecutar(comando, argumentos, opciones = {}) {
  return new Promise((resolver) => {
    const hijo = spawn(comando, argumentos, { cwd: raiz, stdio: "inherit", shell: process.platform === "win32", ...opciones });
    hijo.on("close", (estado) => resolver(estado ?? 1));
  });
}

function salida(comando, argumentos) {
  const r = spawnSync(comando, argumentos, { cwd: raiz, encoding: "utf8", shell: process.platform === "win32" });
  return { estado: r.status ?? 1, texto: `${r.stdout ?? ""}`.trim() };
}

const resultados = [];
async function paso(grupo, nombre, accion) {
  if (!incluye(grupo)) return;
  console.log(`\n=== [${grupo}] ${nombre}`);
  const inicio = Date.now();
  const estado = await accion();
  resultados.push({ grupo, nombre, estado, segundos: Math.round((Date.now() - inicio) / 1000) });
}

// Job "pruebas" (matriz) de ci.yml: las secciones sin interfaz. --paralelo N limita cuántas corren juntas (1 = en serie).
function correrSeccion(seccion) {
  const inicio = Date.now();
  return new Promise((resolver) => {
    const hijo = spawn(process.execPath, ["scripts/pruebas/secciones.mjs", seccion], { cwd: raiz });
    let texto = "";
    hijo.stdout.on("data", (d) => (texto += d));
    hijo.stderr.on("data", (d) => (texto += d));
    hijo.on("close", (estado) => resolver({ seccion, estado: estado ?? 1, texto, segundos: Math.round((Date.now() - inicio) / 1000) }));
  });
}

async function pruebasEnParalelo(limite) {
  const pendientes = [...SECCIONES_CI];
  const trabajador = async () => {
    for (let seccion = pendientes.shift(); seccion; seccion = pendientes.shift()) {
      const r = await correrSeccion(seccion);
      // La salida de cada sección se imprime entera al terminar: sin líneas mezcladas.
      console.log(`\n=== [pruebas] Sección ${r.seccion} (${r.segundos} s)`);
      if (r.estado !== 0) console.log(r.texto.trim());
      resultados.push({ grupo: "pruebas", nombre: `Pruebas de la sección ${r.seccion}`, estado: r.estado, segundos: r.segundos });
    }
  };
  await Promise.all(Array.from({ length: limite }, trabajador));
}

async function pruebas() {
  if (!incluye("pruebas") || args.includes("--sin-pruebas")) return;
  const pedido = args.includes("--paralelo") ? Number(args[args.indexOf("--paralelo") + 1]) : SECCIONES_CI.length;
  const limite = Math.max(1, Math.min(SECCIONES_CI.length, pedido || 1));
  console.log(`\n=== [pruebas] ${SECCIONES_CI.length} secciones, ${limite} a la vez`);
  const inicio = Date.now();
  await pruebasEnParalelo(limite);
  console.log(`\n=== [pruebas] Todas las secciones en ${Math.round((Date.now() - inicio) / 1000)} s de reloj`);
}

// Jobs "verificar" de ci.yml y "dependencias-y-secretos" y "migraciones" de auditoria.yml, en orden.
async function verificarYAuditar() {
  await paso("verificar", "Verificar estilo (eslint de todo el repositorio)", () => ejecutar("pnpm", ["lint"]));
  await paso("verificar", "Verificar tipos", () => ejecutar("pnpm", ["typecheck"]));
  await paso("verificar", "Verificar el reparto de pruebas por secciones", () => ejecutar("pnpm", ["test:verificar-secciones"]));
  if (!args.includes("--sin-build")) await paso("verificar", "Compilar aplicación", () => ejecutar("pnpm", ["build"]));

  await paso("auditoria", "Auditar dependencias de producción (solo CRITICAL)", () => ejecutar("pnpm", ["audit:security"]));
  await paso("auditoria", "Ciclos y violaciones de capas", () => ejecutar("node", ["scripts/auditoria/ciclos.mjs"]));
  await paso("auditoria", "Escanear secretos con gitleaks (historial completo)", () =>
    ejecutar("docker", ["run", "--rm", "-v", `${raiz}:/repo:ro`, "zricethezav/gitleaks:latest", "detect", "--source", "/repo",
      "--config", "/repo/.gitleaks.toml", "--redact", "--no-banner"], DOCKER_SIN_RUTAS));
  await paso("auditoria", "Squawk sobre migraciones nuevas respecto de origin/main", () => {
    const { texto } = salida("git", ["diff", "--name-only", "--diff-filter=A", "origin/main...HEAD", "--", "prisma/migrations/**/migration.sql"]);
    const nuevas = texto.split("\n").filter(Boolean);
    if (!nuevas.length) { console.log("No hay migraciones nuevas."); return 0; }
    return ejecutar("docker", ["run", "--rm", "-v", `${raiz}:/repo:ro`, "--workdir", "/repo", "ghcr.io/sbdchd/squawk:latest",
      "--exclude=prefer-robust-stmts,prefer-text-field,prefer-bigint-over-int,prefer-bigint-over-smallint,require-enum-value-ordering", ...nuevas],
    DOCKER_SIN_RUTAS);
  });
}

const inicioTotal = Date.now();
await Promise.all([pruebas(), verificarYAuditar()]);

const ORDEN_GRUPOS = ["verificar", "auditoria", "pruebas"];
resultados.sort((a, b) => ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo));
console.log(`\n=== Resumen de CI local (${Math.round((Date.now() - inicioTotal) / 1000)} s en total)`);
for (const r of resultados) console.log(`${r.estado === 0 ? "OK    " : "FALLA "} [${r.grupo}] ${r.nombre} (${r.segundos} s)`);
const fallas = resultados.filter((r) => r.estado !== 0).length;
console.log(fallas ? `\n${fallas} pasos fallaron: no suba los cambios.` : "\nTodos los pasos pasan: es seguro subir.");
process.exit(fallas ? 1 : 0);
