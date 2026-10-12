// Detecta ciclos de imports en src con la API de typescript del proyecto (solo lectura).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(raiz, "src");
const EXT = [".ts", ".tsx", ".mts"];
const omitir = (p) => p.includes(path.join("src", "generated")) || /\.test\.tsx?$/.test(p);

function listar(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, acc);
    else if (EXT.includes(path.extname(e.name)) && !omitir(p)) acc.push(p);
  }
  return acc;
}
function resolver(desde, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(src, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(desde), spec);
  else return null;
  for (const c of [base, ...EXT.map((x) => base + x), ...EXT.map((x) => path.join(base, "index" + x))]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}
const archivos = listar(src);
const grafo = new Map();
for (const a of archivos) {
  const info = ts.preProcessFile(fs.readFileSync(a, "utf8"), true, true);
  const deps = new Set();
  for (const imp of info.importedFiles) {
    const r = resolver(a, imp.fileName);
    if (r && !omitir(r)) deps.add(r);
  }
  grafo.set(a, [...deps]);
}
// Tarjan
let idx = 0; const pila = []; const info = new Map(); const sccs = [];
function visitar(v) {
  info.set(v, { i: idx, low: idx, en: true }); idx++; pila.push(v);
  for (const w of grafo.get(v) || []) {
    if (!info.has(w)) { visitar(w); info.get(v).low = Math.min(info.get(v).low, info.get(w).low); }
    else if (info.get(w).en) info.get(v).low = Math.min(info.get(v).low, info.get(w).i);
  }
  if (info.get(v).low === info.get(v).i) {
    const c = []; let w;
    do { w = pila.pop(); info.get(w).en = false; c.push(w); } while (w !== v);
    if (c.length > 1) sccs.push(c);
  }
}
for (const v of grafo.keys()) if (!info.has(v)) visitar(v);
const rel = (p) => path.relative(raiz, p).replace(/\\/g, "/");
console.log(`modulos=${archivos.length} aristas=${[...grafo.values()].reduce((s, d) => s + d.length, 0)} componentes_ciclicos=${sccs.length}`);
sccs.forEach((c, n) => console.log(`ciclo ${n + 1} (${c.length} archivos): ${c.map(rel).join(" <-> ")}`));
// Capas: core no importa de modules/app/components; modules no importan de app
let viol = 0;
for (const [a, deps] of grafo) for (const d of deps) {
  const ra = rel(a), rd = rel(d);
  if (ra.startsWith("src/core/") && /^src\/(modules|app|components)\//.test(rd)) { console.log(`capa: ${ra} -> ${rd}`); viol++; }
  if (ra.startsWith("src/modules/") && rd.startsWith("src/app/")) { console.log(`capa: ${ra} -> ${rd}`); viol++; }
}
console.log(`violaciones_de_capa=${viol}`);
if (sccs.length > 0 || viol > 0) process.exit(1);
