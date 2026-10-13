#!/usr/bin/env node
// Genera CUENTAS-DEMO.local.md con los usuarios de la siembra y sus claves de desarrollo.
// Las claves salen de .env.example (valores ficticios, solo para esta base de demostración local).
// El archivo queda fuera de git (*.local.md). Uso: node scripts/cuentas-demo.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entorno = parseEnv(readFileSync(path.join(raiz, ".env.example"), "utf8"));
const datos = JSON.parse(readFileSync(path.join(raiz, "prisma/seed/datos/usuarios.json"), "utf8"));
const usuarios = Array.isArray(datos) ? datos : datos.usuarios;

const NOMBRES = {
  GERENCIA: "Gerencia", ADMINISTRACION: "Administración", OPERACIONES: "Operaciones",
  ATENCION_CLIENTE: "Atención al cliente", PRODUCCION: "Producción", ADMIN: "Administración técnica",
};
const ORDEN = ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN"];
const clave = (perfil) => entorno[`SEED_PASSWORD_${perfil}`] ?? "(falta en .env.example)";

const principales = ORDEN.map((perfil) => usuarios.find((u) => u.perfil === perfil)).filter(Boolean);
const otros = usuarios.filter((u) => !principales.includes(u));
const fila = (u) => `| ${NOMBRES[u.perfil]} | ${u.nombre} | ${u.cargo} | ${u.correo} | ${clave(u.perfil)} |`;

const texto = `# Cuentas de la base de demostración

Archivo local generado por \`node scripts/cuentas-demo.mjs\`. No se sube a git.
Son claves ficticias de desarrollo (de \`.env.example\`), válidas solo para la base de demostración en http://127.0.0.1:3000.
No las uses fuera de este equipo. Para producción, define claves propias en \`.env\` antes de sembrar.

## Una cuenta por perfil
| Perfil | Nombre | Cargo | Correo | Clave |
|---|---|---|---|---|
${principales.map(fila).join("\n")}

## Otros usuarios de Producción (misma clave del perfil)
| Perfil | Nombre | Cargo | Correo | Clave |
|---|---|---|---|---|
${otros.map(fila).join("\n")}

## Notas
- Los usuarios creados desde la pantalla de administración reciben una clave temporal y deben cambiarla al entrar (caduca en 48 horas).
- Si reinicias la base de demostración, las cuentas vuelven a estas claves.
- Regenera este archivo si cambian los usuarios de la siembra o las claves de \`.env.example\`.
`;

writeFileSync(path.join(raiz, "CUENTAS-DEMO.local.md"), texto);
console.log(`CUENTAS-DEMO.local.md generado: ${principales.length} cuentas principales y ${otros.length} de Producción.`);
