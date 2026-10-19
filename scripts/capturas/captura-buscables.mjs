// Filtros y campos con búsqueda abiertos: node captura-buscables.mjs <carpeta>
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
const repo = "C:/Proyectos/sc-plataforma";
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("@playwright/test");
const [salida] = process.argv.slice(2);
mkdirSync(salida, { recursive: true });
const claves = Object.fromEntries(readFileSync(path.join(repo, ".env.example"), "utf8").split(/\r?\n/)
  .filter((l) => l.startsWith("SEED_PASSWORD_")).map((l) => l.split("=").map((p) => p.trim().replace(/^"|"$/g, ""))));
const navegador = await chromium.launch();
const pagina = await (await navegador.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-NI" })).newPage();
await pagina.goto("http://127.0.0.1:3000/login");
await pagina.getByLabel("Correo electrónico").fill("gerardo.jimenez@solucionescreativas.test");
await pagina.locator("#contrasena").fill(claves.SEED_PASSWORD_GERENCIA);
await pagina.getByRole("button", { name: "Ingresar" }).click();
await pagina.waitForURL((url) => !url.pathname.startsWith("/login"));
async function abrir(ruta, etiqueta, texto, nombre) {
  await pagina.goto(`http://127.0.0.1:3000${ruta}`); await pagina.waitForTimeout(900);
  await pagina.getByRole("button", { name: /Más filtros/ }).first().click(); await pagina.waitForTimeout(300);
  await pagina.getByLabel(etiqueta, { exact: true }).click(); await pagina.waitForTimeout(300);
  await pagina.keyboard.type(texto); await pagina.waitForTimeout(400);
  await pagina.screenshot({ path: path.join(salida, `${nombre}.png`), clip: { x: 256, y: 60, width: 1110, height: 620 } });
}
await abrir("/cotizaciones", "Cliente", "hot", "filtro-cliente");
await abrir("/inventario?pestana=movimientos", "Material", "lam", "filtro-material");
await abrir("/ordenes", "Responsable", "mar", "filtro-responsable");
await navegador.close();
console.log("buscables ok");
