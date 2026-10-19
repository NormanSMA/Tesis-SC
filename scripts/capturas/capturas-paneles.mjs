// Panel de cada perfil a 1366 px (página completa) para revisión de Norman.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repo = "C:/Proyectos/sc-plataforma";
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("@playwright/test");
const salida = process.argv[2];
const ancho = Number(process.argv[3] ?? 1366);
mkdirSync(salida, { recursive: true });
const claves = Object.fromEntries(readFileSync(path.join(repo, ".env.example"), "utf8").split(/\r?\n/)
  .filter((linea) => linea.startsWith("SEED_PASSWORD_")).map((linea) => linea.split("=").map((parte) => parte.trim().replace(/^"|"$/g, ""))));
const perfiles = [
  ["1-gerencia", "gerardo.jimenez", "SEED_PASSWORD_GERENCIA"],
  ["2-atencion-cliente", "valentina.castro", "SEED_PASSWORD_ATENCION_CLIENTE"],
  ["3-operaciones", "karla.reyes", "SEED_PASSWORD_OPERACIONES"],
  ["4-produccion", "marco.lopez", "SEED_PASSWORD_PRODUCCION"],
  ["5-administracion", "luis.mendoza", "SEED_PASSWORD_ADMINISTRACION"],
  ["6-admin-sistema", "roberto.diaz", "SEED_PASSWORD_ADMIN", true],
];
const navegador = await chromium.launch();
for (const [nombre, usuario, clave, sinPanel] of perfiles) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: ancho < 500 ? 844 : 900 }, locale: "es-NI" });
  const pagina = await contexto.newPage();
  await pagina.goto("http://127.0.0.1:3000/login");
  await pagina.getByLabel("Correo electrónico").fill(`${usuario}@solucionescreativas.test`);
  await pagina.locator("#contrasena").fill(claves[clave]);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  if (!sinPanel) await pagina.goto("http://127.0.0.1:3000/panel");
  await pagina.waitForTimeout(1200);
  await pagina.screenshot({ path: path.join(salida, `panel-${nombre}-${ancho}.png`), fullPage: true });
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(nombre, desborde ? "DESBORDA" : "ok");
  await contexto.close();
}
await navegador.close();
