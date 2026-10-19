// Logo de cliente, buscador global y estado del sistema: node captura-nuevas.mjs <carpeta> <ancho>
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
const repo = "C:/Proyectos/sc-plataforma";
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("@playwright/test");
const [salida, anchoTexto, logo] = process.argv.slice(2);
const ancho = Number(anchoTexto); const movil = ancho < 500;
mkdirSync(salida, { recursive: true });
const claves = Object.fromEntries(readFileSync(path.join(repo, ".env.example"), "utf8").split(/\r?\n/)
  .filter((l) => l.startsWith("SEED_PASSWORD_")).map((l) => l.split("=").map((p) => p.trim().replace(/^"|"$/g, ""))));
const navegador = await chromium.launch();
async function sesion(correo, clave) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: movil ? 844 : 900 }, isMobile: movil, hasTouch: movil, locale: "es-NI" });
  const pagina = await contexto.newPage();
  await pagina.goto("http://127.0.0.1:3000/login");
  await pagina.getByLabel("Correo electrónico").fill(`${correo}@solucionescreativas.test`);
  await pagina.locator("#contrasena").fill(claves[clave]);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"));
  return pagina;
}
const C = process.env.CLIENTE_ID;
let p = await sesion("valentina.castro", "SEED_PASSWORD_ATENCION_CLIENTE");
await p.goto(`http://127.0.0.1:3000/clientes/${C}/editar`); await p.waitForTimeout(1200);
await p.locator('input[type="file"]').setInputFiles(logo); await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(salida, `logo-formulario-${ancho}.png`) });
await p.getByRole("button", { name: "Guardar cambios" }).click(); await p.waitForURL(new RegExp(`/clientes/${C}$`)); await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(salida, `logo-ficha-${ancho}.png`) });
await p.goto("http://127.0.0.1:3000/clientes"); await p.waitForTimeout(1200);
await p.screenshot({ path: path.join(salida, `logo-lista-${ancho}.png`) });
p = await sesion("gerardo.jimenez", "SEED_PASSWORD_GERENCIA");
if (movil) await p.getByRole("button", { name: "Abrir menú de navegación" }).click();
await p.getByRole("button", { name: "Buscar en TRACORE" }).last().click(); await p.waitForTimeout(300);
await p.keyboard.type("vinil"); await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(salida, `buscador-vinil-${ancho}.png`) });
p = await sesion("roberto.diaz", "SEED_PASSWORD_ADMIN");
await p.goto("http://127.0.0.1:3000/admin/sistema"); await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(salida, `sistema-${ancho}.png`), fullPage: true });
await navegador.close();
console.log(`nuevas ${ancho} ok`);
