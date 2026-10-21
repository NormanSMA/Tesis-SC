#!/usr/bin/env node
// Verificación rápida de lo que cambió respecto de HEAD: tipos, estilo y pruebas unitarias relacionadas.
// Uso: node scripts/verificar-rapido.mjs   (pnpm check:fast)
// No cubre integración ni interfaz: vitest related no sigue import() dinámicos y esas pruebas los usan.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONES = /\.(ts|tsx|mts)$/;
// Con muchos archivos, eslint revisa todo usando su caché: evita líneas de comandos enormes.
const MAXIMO_ARCHIVOS = 200;
// Se llama a cada binario con node, sin pnpm exec ni shell: ahorra el arranque de pnpm.
const BINARIOS = {
  tsc: "node_modules/typescript/bin/tsc",
  eslint: "node_modules/eslint/bin/eslint.js",
  vitest: "node_modules/vitest/vitest.mjs",
};
const CACHE_ESLINT = ["--cache", "--cache-strategy", "content", "--cache-location", ".next/cache/eslint/.eslintcache"];

function lineasGit(argumentos) {
  const r = spawnSync("git", argumentos, { cwd: raiz, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${argumentos.join(" ")} falló: ${r.stderr}`);
  return r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}

function archivosCambiados() {
  const todos = [...lineasGit(["diff", "--name-only", "HEAD"]), ...lineasGit(["ls-files", "--others", "--exclude-standard"])];
  return [...new Set(todos)].filter((a) => EXTENSIONES.test(a) && !a.startsWith("src/generated/") && existsSync(path.join(raiz, a)));
}

function ejecutar(nombre, binario, argumentos) {
  const inicio = Date.now();
  return new Promise((resolver) => {
    const hijo = spawn(process.execPath, [path.join(raiz, BINARIOS[binario]), ...argumentos], { cwd: raiz });
    let texto = "";
    hijo.stdout.on("data", (d) => (texto += d));
    hijo.stderr.on("data", (d) => (texto += d));
    hijo.on("close", (estado) => resolver({ nombre, estado: estado ?? 1, texto, segundos: (Date.now() - inicio) / 1000 }));
  });
}

const archivos = archivosCambiados();
if (!archivos.length) {
  console.log("Sin archivos .ts/.tsx/.mts cambiados respecto de HEAD.");
  process.exit(0);
}
console.log(`Archivos cambiados: ${archivos.length}`);

const objetivoEslint = archivos.length > MAXIMO_ARCHIVOS ? [] : archivos;
const resultados = await Promise.all([
  ejecutar("tipos", "tsc", ["--noEmit"]),
  ejecutar("estilo", "eslint", [...CACHE_ESLINT, "--no-warn-ignored", ...objetivoEslint]),
  ejecutar("unitarias", "vitest", ["related", "--run", "--project", "unit", "--passWithNoTests", ...archivos]),
]);

for (const r of resultados) {
  console.log(`${r.estado === 0 ? "OK    " : "FALLA "} ${r.nombre} (${r.segundos.toFixed(1)} s)`);
  if (r.estado !== 0) console.log(r.texto.trim());
}
process.exit(Math.max(...resultados.map((r) => r.estado)));
