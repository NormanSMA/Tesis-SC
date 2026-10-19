// Menú móvil abierto a 390 px (Gerencia y administrador del sistema).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const repo = "C:/Proyectos/sc-plataforma";
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("@playwright/test");
const salida = process.argv[2];
const claves = Object.fromEntries(readFileSync(path.join(repo, ".env.example"), "utf8").split(/\r?\n/)
  .filter((linea) => linea.startsWith("SEED_PASSWORD_")).map((linea) => linea.split("=").map((parte) => parte.trim().replace(/^"|"$/g, ""))));
const navegador = await chromium.launch();
for (const [nombre, usuario, clave] of [["gerencia", "gerardo.jimenez", "SEED_PASSWORD_GERENCIA"], ["admin-sistema", "roberto.diaz", "SEED_PASSWORD_ADMIN"]]) {
  const pagina = await (await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-NI" })).newPage();
  await pagina.goto("http://127.0.0.1:3000/login");
  await pagina.getByLabel("Correo electrónico").fill(`${usuario}@solucionescreativas.test`);
  await pagina.locator("#contrasena").fill(claves[clave]);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  await pagina.waitForTimeout(800);
  if (nombre === "admin-sistema") await pagina.screenshot({ path: path.join(salida, `usuarios-${nombre}-390.png`), fullPage: true });
  await pagina.getByRole("button", { name: "Abrir menú de navegación" }).click();
  await pagina.waitForTimeout(500);
  await pagina.screenshot({ path: path.join(salida, `menu-movil-${nombre}-390.png`) });
  await pagina.context().close();
}
await navegador.close();
console.log("ok");
