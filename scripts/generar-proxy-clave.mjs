#!/usr/bin/env node
// Agrega PROXY_CLAVE (64 caracteres hexadecimales) a .env si todavía no existe. No imprime la clave.
// La app solo confía en X-Forwarded-For cuando el proxy envía esta clave (ADR-017).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archivo = path.join(raiz, ".env");
const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";

if (/^PROXY_CLAVE=.{32,}$/m.test(actual)) {
  console.log("PROXY_CLAVE ya existe en .env. No se cambia.");
} else {
  const base = actual.replace(/^PROXY_CLAVE=.*\n?/m, "");
  const separador = base.length && !base.endsWith("\n") ? "\n" : "";
  writeFileSync(archivo, `${base}${separador}PROXY_CLAVE=${randomBytes(32).toString("hex")}\n`);
  console.log("PROXY_CLAVE agregada a .env. Reinicie app y proxy: docker compose --profile proxy up -d app proxy");
}
