#!/usr/bin/env node
// Copia cifrada del último respaldo a otra carpeta o disco.
//   SC_RESPALDO_CLAVE="<frase de 14 o más caracteres>" node scripts/respaldo/externo.mjs cifrar <destino> [--retener N]
//   SC_RESPALDO_CLAVE="<frase>" node scripts/respaldo/externo.mjs descifrar <archivo.dump.enc> <salida.dump>
// La frase solo viaja por variable de entorno: no se imprime ni se guarda. Guárdela aparte del disco de copia.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { cifrar, descifrar } from "./cifrado.mjs";

const VOLUMEN = process.env.SC_RESPALDO_VOLUMEN ?? "sc-plataforma_sc_respaldos";
const IMAGEN = process.env.SC_RESPALDO_IMAGEN ?? "postgres:17-alpine@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73";

function docker(...args) {
  const r = spawnSync("docker", ["run", "--rm", "-v", `${VOLUMEN}:/r:ro`, "--entrypoint", "sh", IMAGEN, "-c", ...args], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`docker falló: ${String(r.stderr).trim() || "sin detalle"}`);
  return r.stdout;
}

function frase() {
  const valor = process.env.SC_RESPALDO_CLAVE;
  if (!valor) throw new Error("Defina SC_RESPALDO_CLAVE antes de ejecutar.");
  return valor;
}

function marca() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

function ultimoRespaldo() {
  const nombre = String(docker("ls -t /r/sc-plataforma-*.dump 2>/dev/null | head -1")).trim();
  if (!nombre) throw new Error("No hay respaldos en el volumen.");
  return nombre;
}

function retener(destino, cantidad) {
  const copias = readdirSync(destino).filter((f) => /^sc-plataforma-.*\.dump\.enc$/.test(f))
    .map((f) => ({ f, t: statSync(path.join(destino, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const { f } of copias.slice(cantidad)) rmSync(path.join(destino, f));
  return Math.max(0, copias.length - cantidad);
}

function ordenCifrar(destino, args) {
  if (!destino) throw new Error("Indique la carpeta de destino.");
  const clave = frase();
  const archivo = ultimoRespaldo();
  const contenido = docker(`cat ${archivo}`);
  mkdirSync(destino, { recursive: true });
  const salida = path.join(destino, `${path.basename(archivo)}.${marca()}.enc`.replace(".dump.", ".").replace(/\.enc$/, ".dump.enc"));
  writeFileSync(salida, cifrar(contenido, clave));
  console.log(`Copia cifrada: ${salida} (${statSync(salida).size} bytes) a partir de ${path.basename(archivo)}.`);
  const i = args.indexOf("--retener");
  if (i >= 0) console.log(`Copias antiguas retiradas: ${retener(destino, Number(args[i + 1]))}.`);
}

function ordenDescifrar(entrada, salida) {
  if (!entrada || !salida) throw new Error("Indique el archivo cifrado y la salida.");
  writeFileSync(salida, descifrar(readFileSync(entrada), frase()));
  console.log(`Respaldo descifrado en ${salida}. Restáurelo con scripts/restaurar.sh.`);
}

try {
  const [orden, ...resto] = process.argv.slice(2);
  if (orden === "cifrar") ordenCifrar(resto[0], resto);
  else if (orden === "descifrar") ordenDescifrar(resto[0], resto[1]);
  else throw new Error("Uso: externo.mjs cifrar <destino> [--retener N] | descifrar <archivo.enc> <salida.dump>");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
