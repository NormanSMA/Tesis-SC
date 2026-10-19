// Lista los elementos más anchos que la ventana: node elemento-ancho.mjs <ancho> <perfil> <ruta>
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
const repo = "C:/Proyectos/sc-plataforma";
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("@playwright/test");
const [anchoTexto, perfil, ruta] = process.argv.slice(2);
const claves = Object.fromEntries(readFileSync(path.join(repo, ".env.example"), "utf8").split(/\r?\n/)
  .filter((l) => l.startsWith("SEED_PASSWORD_")).map((l) => l.split("=").map((p) => p.trim().replace(/^"|"$/g, ""))));
const CUENTAS = { operaciones: ["karla.reyes", "SEED_PASSWORD_OPERACIONES"], administracion: ["luis.mendoza", "SEED_PASSWORD_ADMINISTRACION"], atencion: ["valentina.castro", "SEED_PASSWORD_ATENCION_CLIENTE"] };
const [usuario, clave] = CUENTAS[perfil];
const ancho = Number(anchoTexto);
const navegador = await chromium.launch();
const pagina = await (await navegador.newContext({ viewport: { width: ancho, height: 844 }, isMobile: ancho < 500, hasTouch: ancho < 500 })).newPage();
await pagina.goto("http://127.0.0.1:3000/login");
await pagina.getByLabel("Correo electrónico").fill(`${usuario}@solucionescreativas.test`);
await pagina.locator("#contrasena").fill(claves[clave]);
await pagina.getByRole("button", { name: "Ingresar" }).click();
await pagina.waitForURL((url) => !url.pathname.startsWith("/login"));
await pagina.goto(`http://127.0.0.1:3000${ruta}`); await pagina.waitForTimeout(1200);
console.log(await pagina.evaluate((w) => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > w + 1)
  .slice(-6).map((e) => `${e.tagName}.${String(e.className).slice(0, 90)} right=${Math.round(e.getBoundingClientRect().right)}`).join("\n"), ancho));
await navegador.close();
