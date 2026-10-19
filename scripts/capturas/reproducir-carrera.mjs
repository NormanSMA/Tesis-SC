// Reproduce la carrera "escribir y hacer clic antes del debounce" con CPU lenta: node reproducir-carrera.mjs [intentos]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
const require = createRequire(path.join("C:/Proyectos/sc-plataforma", "package.json"));
const { chromium } = require("@playwright/test");
const intentos = Number(process.argv[2] ?? 5);
const claves = Object.fromEntries(readFileSync(".env.example", "utf8").split(/\r?\n/)
  .filter((l) => l.startsWith("SEED_PASSWORD_")).map((l) => l.split("=").map((p) => p.trim().replace(/^"|"$/g, ""))));
const navegador = await chromium.launch();
const pagina = await (await navegador.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const cdp = await pagina.context().newCDPSession(pagina);
await pagina.goto("http://127.0.0.1:3000/login");
await pagina.getByLabel("Correo electrónico").fill("karla.reyes@solucionescreativas.test");
await pagina.locator("#contrasena").fill(claves.SEED_PASSWORD_OPERACIONES);
await pagina.getByRole("button", { name: "Ingresar" }).click();
await pagina.waitForURL((url) => !url.pathname.startsWith("/login"));
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
let regresos = 0;
for (let i = 0; i < intentos; i += 1) {
  await pagina.goto("http://127.0.0.1:3000/ordenes"); await pagina.waitForTimeout(800);
  const enlace = pagina.getByRole("link", { name: /^OT-\d{4}-\d{4}$/ }).first();
  const numero = await enlace.textContent();
  await pagina.getByLabel("Buscar órdenes", { exact: true }).fill(numero);
  await pagina.getByRole("link", { name: numero, exact: true }).click();
  await pagina.waitForTimeout(2500);
  const ruta = new URL(pagina.url()).pathname;
  if (!/^\/ordenes\/[0-9a-f-]{36}$/.test(ruta)) regresos += 1;
  console.log(`intento ${i + 1}: ${pagina.url().replace("http://127.0.0.1:3000", "")}`);
}
console.log(`Regresos a la lista: ${regresos} de ${intentos}`);
await navegador.close();
