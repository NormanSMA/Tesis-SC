// Utilidades compartidas de los scripts de carga. Solo Node y las dependencias ya instaladas.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DIRECTORIO = resolve(RAIZ, "scripts", "carga");
export const ARCHIVO_SESIONES = resolve(DIRECTORIO, "sesiones.json");
export const ARCHIVO_CONCURRENCIA = resolve(DIRECTORIO, "concurrencia.json");
export const ARCHIVO_ESTADO = resolve(DIRECTORIO, "estado.json");
export const BASE_CARGA = "sc_carga";

function leerArchivoEnv(ruta) {
  if (!existsSync(ruta)) return {};
  const salida = {};
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
    if (!m) continue;
    salida[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return salida;
}

/** .env.example, luego .env, luego el proceso: mismo orden que compose.yaml. */
export function leerEntorno() {
  return { ...leerArchivoEnv(resolve(RAIZ, ".env.example")), ...leerArchivoEnv(resolve(RAIZ, ".env")), ...process.env };
}

/** Conexion como dueno de las tablas a la base sc_carga del servidor db (nunca sc_plataforma). */
export function configuracionBase() {
  const e = leerEntorno();
  for (const k of ["POSTGRES_USER", "POSTGRES_PASSWORD"]) if (!e[k]) throw new Error(`Falta ${k} en .env.example o .env.`);
  return {
    host: "127.0.0.1", port: Number(e.DB_PORT || 5442), user: e.POSTGRES_USER, password: e.POSTGRES_PASSWORD,
    database: e.CARGA_DB || BASE_CARGA,
  };
}

export async function conectar() {
  const cliente = new pg.Client(configuracionBase());
  await cliente.connect();
  if (cliente.database === "sc_plataforma") throw new Error("La carga nunca usa la base demo sc_plataforma.");
  return cliente;
}

export function leerOpciones(argumentos, permitidas) {
  const opciones = {};
  for (let i = 0; i < argumentos.length; i++) {
    const clave = argumentos[i].replace(/^--/, "");
    if (!argumentos[i].startsWith("--") || !(clave in permitidas)) throw new Error(`Opcion no valida: ${argumentos[i]}`);
    if (permitidas[clave] === "bool") opciones[clave] = true;
    else opciones[clave] = argumentos[++i];
  }
  return opciones;
}

export function leerJson(ruta) {
  return JSON.parse(readFileSync(ruta, "utf8"));
}
