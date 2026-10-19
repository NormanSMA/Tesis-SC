// Captura rutas de un perfil a un ancho: node capturas-pantallas.mjs <carpeta> <ancho> <perfil> <ruta> [ruta...]
// Perfiles: gerencia, atencion, operaciones, produccion, administracion, admin.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repo = "C:/Proyectos/sc-plataforma";
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("@playwright/test");
const [salida, anchoTexto, perfil, ...rutas] = process.argv.slice(2);
const ancho = Number(anchoTexto);
mkdirSync(salida, { recursive: true });
const claves = Object.fromEntries(readFileSync(path.join(repo, ".env.example"), "utf8").split(/\r?\n/)
  .filter((linea) => linea.startsWith("SEED_PASSWORD_")).map((linea) => linea.split("=").map((parte) => parte.trim().replace(/^"|"$/g, ""))));
const CUENTAS = {
  gerencia: ["gerardo.jimenez", "SEED_PASSWORD_GERENCIA"], atencion: ["valentina.castro", "SEED_PASSWORD_ATENCION_CLIENTE"],
  operaciones: ["karla.reyes", "SEED_PASSWORD_OPERACIONES"], produccion: ["marco.lopez", "SEED_PASSWORD_PRODUCCION"],
  administracion: ["luis.mendoza", "SEED_PASSWORD_ADMINISTRACION"], admin: ["roberto.diaz", "SEED_PASSWORD_ADMIN"],
};
const [usuario, clave] = CUENTAS[perfil];
const movil = ancho < 500;
const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: ancho, height: movil ? 844 : 900 }, isMobile: movil, hasTouch: movil, locale: "es-NI" });
const pagina = await contexto.newPage();
await pagina.goto("http://127.0.0.1:3000/login");
await pagina.getByLabel("Correo electrónico").fill(`${usuario}@solucionescreativas.test`);
await pagina.locator("#contrasena").fill(claves[clave]);
await pagina.getByRole("button", { name: "Ingresar" }).click();
await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
for (const ruta of rutas) {
  await pagina.goto(`http://127.0.0.1:3000${ruta}`); await pagina.waitForTimeout(1000);
  const nombre = ruta.replace(/^\//, "").replace(/[/?=&]+/g, "-") || "inicio";
  const d = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (d > 0) console.log(`DESBORDE ${d}px ${ruta} ${ancho}`);
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  process.stdout.write(`${nombre} ${desborde ? "DESBORDA" : "ok"}\n`);
}
await navegador.close();
