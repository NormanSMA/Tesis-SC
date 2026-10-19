// Compara lo que mide la aplicacion en /api/v1/sistema con el resumen de k6.
// Uso: node scripts/carga/comparar-sistema.mjs --k6 output/carga/lectura-mixta.json [--base http://127.0.0.1:3100] [--salida ruta.json]
// Correr justo despues de k6: /api/v1/sistema solo conserva las ultimas 500 peticiones del proceso.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ARCHIVO_SESIONES, RAIZ, leerJson, leerOpciones } from "./comun.mjs";
import { contador, valor } from "./resumen-k6.mjs";

const pct = (x) => (x === null ? "sin dato" : `${(x * 100).toFixed(2)} %`);
const ms = (x) => (x === null ? "sin dato" : `${x.toFixed(1)} ms`);
const delta = (a, b, formato) => (a === null || b === null ? "sin dato" : `${a - b >= 0 ? "+" : ""}${formato(a - b)}`);

async function leerSistema(base, cookie, origen) {
  const res = await fetch(`${base}/api/v1/sistema`, { headers: { cookie, origin: origen, accept: "application/json" } });
  if (!res.ok) throw new Error(`/api/v1/sistema respondio ${res.status}.`);
  return (await res.json()).datos;
}

async function main() {
  const opciones = leerOpciones(process.argv.slice(2), { k6: "valor", base: "valor", salida: "valor" });
  if (!opciones.k6) throw new Error("Indique --k6 con el resumen JSON de k6.");
  const base = opciones.base ?? "http://127.0.0.1:3100";
  const k6 = leerJson(resolve(RAIZ, opciones.k6));
  const admin = leerJson(ARCHIVO_SESIONES).find((s) => s.perfil === "ADMIN");
  if (!admin) throw new Error("No hay sesion ADMIN en sesiones.json.");
  const sistema = await leerSistema(base, admin.cookie, base);
  const r = sistema.rendimiento;

  const total = contador(k6, "http_reqs");
  const e5xx = contador(k6, "errores_5xx");
  const esperados4xx = contador(k6, "respuestas_409") + contador(k6, "respuestas_422") + contador(k6, "respuestas_429");
  const fallidas = valor(k6, "http_req_failed", "passes") ?? 0;
  const k6p95 = valor(k6, "http_req_duration", "p(95)");
  const k6Tasa5xx = total ? e5xx / total : 0;
  const k6Tasa4xx = total ? (esperados4xx + Math.max(0, fallidas - e5xx)) / total : 0;

  const filas = [
    ["p95 de duracion", ms(k6p95), ms(r.p95Ms), delta(r.p95Ms, k6p95, (x) => `${x.toFixed(1)} ms`)],
    ["tasa de 5xx", pct(k6Tasa5xx), pct(r.tasa5xx), delta(r.tasa5xx, k6Tasa5xx, pct)],
    ["tasa de 4xx", pct(k6Tasa4xx), pct(r.tasa4xx), delta(r.tasa4xx, k6Tasa4xx, pct)],
    ["peticiones", String(total), `${r.peticiones} (ventana)`, delta(r.peticiones, total, String)],
  ];
  const ancho = [0, 1, 2, 3].map((i) => Math.max(...filas.map((f) => f[i].length), ["Metrica", "k6 (cliente)", "sistema (servidor)", "diferencia"][i].length));
  const linea = (f) => f.map((c, i) => c.padEnd(ancho[i])).join("  ");
  process.stdout.write(`${linea(["Metrica", "k6 (cliente)", "sistema (servidor)", "diferencia"])}\n`);
  for (const f of filas) process.stdout.write(`${linea(f)}\n`);
  process.stdout.write("Notas:\n");
  process.stdout.write(`- /api/v1/sistema promedia las ultimas ${r.peticiones} peticiones (tope 500) desde ${r.desde}; k6 cuenta toda la corrida.\n`);
  process.stdout.write("- k6 mide extremo a extremo (red incluida). El sistema mide dentro del proceso. Se espera p95 de k6 mayor o igual.\n");
  const avisos = [];
  if (e5xx > 0 && r.tasa5xx === 0) avisos.push("k6 vio 5xx que el sistema no registra en su ventana.");
  if (r.tasa5xx > 0 && e5xx === 0) avisos.push("el sistema registra 5xx que k6 no vio.");
  if (r.p95Ms !== null && k6p95 !== null && r.p95Ms > k6p95) avisos.push("el p95 del servidor supera al de k6: revise que la ventana corresponda a esta corrida.");
  for (const a of avisos) process.stdout.write(`DIFERENCIA: ${a}\n`);
  if (!avisos.length) process.stdout.write("Sin diferencias de criterio entre k6 y el sistema.\n");
  if (opciones.salida) {
    const ruta = resolve(RAIZ, opciones.salida);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, JSON.stringify({ k6: { total, e5xx, tasa5xx: k6Tasa5xx, tasa4xx: k6Tasa4xx, p95Ms: k6p95 }, sistema: r, avisos }, null, 2));
  }
}

main().catch((error) => {
  process.stderr.write(`La comparacion fallo: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
