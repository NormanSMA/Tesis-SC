import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const exclusiones = "prefer-robust-stmts,prefer-text-field,prefer-bigint-over-int,prefer-bigint-over-smallint,require-enum-value-ordering";
export const huellaSql = (texto) => createHash("sha256").update(texto.replace(/\r\n/g, "\n")).digest("hex");

export function validarHistoricas({ revisadas, leer }) {
  for (const registro of revisadas.archivos) {
    if (registro.hallazgos.some((h) => !h.regla || !Number.isInteger(h.linea) || !Number.isInteger(h.columna))) {
      throw new Error(`Revisión histórica incompleta: ${registro.archivo}`);
    }
    if (huellaSql(leer(registro.archivo)) !== registro.sha256Lf) {
      throw new Error(`Migración histórica modificada: ${registro.archivo}. Cree una migración nueva.`);
    }
  }
}

export function separarHallazgos({ hallazgos, revisadas }) {
  const clave = (h) => `${h.regla}:${h.linea}:${h.columna}`;
  const conocidas = new Map(revisadas.archivos.map((r) => [r.archivo, new Set(r.hallazgos.map(clave))]));
  return hallazgos.filter((h) => !conocidas.get(h.file)?.has(clave({ regla: h.rule_name, linea: h.line, columna: h.column })));
}

function ejecutar(comando, argumentos) {
  const resultado = spawnSync(comando, argumentos, { cwd: raiz, encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  if (resultado.error || ![0, 1].includes(resultado.status)) throw new Error(resultado.error?.message ?? resultado.stderr);
  return resultado;
}

function archivosPendientes() {
  const base = process.argv[2] ?? "origin/main";
  const cambios = ejecutar("git", ["diff", "--name-only", "--diff-filter=AM", base, "--", "prisma/migrations/**/migration.sql"]);
  const nuevos = ejecutar("git", ["ls-files", "--others", "--exclude-standard", "--", "prisma/migrations/**/migration.sql"]);
  return [...new Set(`${cambios.stdout}\n${nuevos.stdout}`.split(/\r?\n/).filter(Boolean))];
}

function auditar() {
  const revisadas = JSON.parse(readFileSync(path.join(raiz, ".github/squawk-revisadas.json"), "utf8"));
  validarHistoricas({ revisadas, leer: (archivo) => readFileSync(path.join(raiz, archivo), "utf8") });
  const archivos = archivosPendientes();
  if (!archivos.length) { console.log("Sin migraciones pendientes; huellas históricas verificadas."); return; }
  const resultado = ejecutar("docker", ["run", "--rm", "--volume", `${raiz}:/repo:ro`, "--workdir", "/repo", revisadas.imagen,
    "--reporter", "json", `--exclude=${exclusiones}`, ...archivos]);
  const hallazgos = JSON.parse(resultado.stdout);
  const pendientes = separarHallazgos({ hallazgos, revisadas });
  console.log(`SQL: ${archivos.length} archivos; ${hallazgos.length - pendientes.length} avisos históricos revisados; ${pendientes.length} avisos nuevos.`);
  for (const h of pendientes) console.error(`${h.file}:${h.line + 1}:${h.column + 1} ${h.rule_name}: ${h.message}`);
  if (pendientes.length) throw new Error("Hay hallazgos SQL sin revisar; no publicar.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { auditar(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
