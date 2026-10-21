#!/usr/bin/env node
// Reproduce en esta máquina los pasos de .github/workflows/ci.yml y auditoria.yml antes de subir cambios.
// Uso: node scripts/ci-local.mjs [--sin-build] [--sin-pruebas] [--solo <verificar|auditoria|pruebas>]
// Necesita Docker solo para gitleaks y Squawk (imágenes ya descargadas). No hace push ni cambia git.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const solo = args.includes("--solo") ? args[args.indexOf("--solo") + 1] : null;
const incluye = (grupo) => !solo || solo === grupo;

function ejecutar(comando, argumentos, opciones = {}) {
  const r = spawnSync(comando, argumentos, { cwd: raiz, stdio: "inherit", shell: process.platform === "win32", ...opciones });
  return r.status ?? 1;
}

function salida(comando, argumentos) {
  const r = spawnSync(comando, argumentos, { cwd: raiz, encoding: "utf8", shell: process.platform === "win32" });
  return { estado: r.status ?? 1, texto: `${r.stdout ?? ""}`.trim() };
}

const resultados = [];
function paso(grupo, nombre, accion) {
  if (!incluye(grupo)) return;
  console.log(`\n=== [${grupo}] ${nombre}`);
  const inicio = Date.now();
  const estado = accion();
  resultados.push({ grupo, nombre, estado, segundos: Math.round((Date.now() - inicio) / 1000) });
}

// Job "verificar" de ci.yml
paso("verificar", "Verificar estilo (eslint de todo el repositorio)", () => ejecutar("pnpm", ["lint"]));
paso("verificar", "Verificar tipos", () => ejecutar("pnpm", ["typecheck"]));
paso("verificar", "Verificar el reparto de pruebas por secciones", () => ejecutar("pnpm", ["test:verificar-secciones"]));
if (!args.includes("--sin-build")) paso("verificar", "Compilar aplicación", () => ejecutar("pnpm", ["build"]));

// Job "dependencias-y-secretos" y "migraciones" de auditoria.yml
paso("auditoria", "Auditar dependencias de producción (solo CRITICAL)", () => ejecutar("pnpm", ["audit:security"]));
paso("auditoria", "Ciclos y violaciones de capas", () => ejecutar("node", ["scripts/auditoria/ciclos.mjs"]));
paso("auditoria", "Escanear secretos con gitleaks (historial completo)", () =>
  ejecutar("docker", ["run", "--rm", "-v", `${raiz}:/repo:ro`, "zricethezav/gitleaks:latest", "detect", "--source", "/repo",
    "--config", "/repo/.gitleaks.toml", "--redact", "--no-banner"], { env: { ...process.env, MSYS_NO_PATHCONV: "1" } }));
paso("auditoria", "Squawk sobre migraciones nuevas respecto de origin/main", () => {
  const { texto } = salida("git", ["diff", "--name-only", "--diff-filter=A", "origin/main...HEAD", "--", "prisma/migrations/**/migration.sql"]);
  const nuevas = texto.split("\n").filter(Boolean);
  if (!nuevas.length) { console.log("No hay migraciones nuevas."); return 0; }
  return ejecutar("docker", ["run", "--rm", "-v", `${raiz}:/repo:ro`, "--workdir", "/repo", "ghcr.io/sbdchd/squawk:latest",
    "--exclude=prefer-robust-stmts,prefer-text-field,prefer-bigint-over-int,prefer-bigint-over-smallint,require-enum-value-ordering", ...nuevas],
  { env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
});

// Job "pruebas" (matriz) de ci.yml: las secciones sin interfaz, una tras otra
if (!args.includes("--sin-pruebas")) {
  for (const seccion of ["nucleo", "acceso", "clientes", "catalogo", "cotizaciones", "ordenes", "produccion", "inventario", "analitica"]) {
    paso("pruebas", `Pruebas de la sección ${seccion}`, () => ejecutar("node", ["scripts/pruebas/secciones.mjs", seccion]));
  }
}

console.log("\n=== Resumen de CI local");
for (const r of resultados) console.log(`${r.estado === 0 ? "OK    " : "FALLA "} [${r.grupo}] ${r.nombre} (${r.segundos} s)`);
const fallas = resultados.filter((r) => r.estado !== 0).length;
console.log(fallas ? `\n${fallas} pasos fallaron: no suba los cambios.` : "\nTodos los pasos pasan: es seguro subir.");
process.exit(fallas ? 1 : 0);
