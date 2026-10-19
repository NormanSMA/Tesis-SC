// Capturas del rediseño: panel por perfil a 3 anchos, drawer y modal de cliente.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repo = "C:/Proyectos/sc-plataforma";
const require = createRequire(path.join(repo, "package.json"));
const { chromium } = require("@playwright/test");
const base = "http://127.0.0.1:3000";
const salida = process.argv[2];
mkdirSync(salida, { recursive: true });

const entorno = Object.fromEntries(readFileSync(path.join(repo, ".env.example"), "utf8").split(/\r?\n/)
  .filter((linea) => linea.startsWith("SEED_PASSWORD_")).map((linea) => linea.split("=").map((parte) => parte.trim().replace(/^"|"$/g, ""))));
const perfiles = {
  gerencia: { correo: "gerardo.jimenez@solucionescreativas.test", clave: entorno.SEED_PASSWORD_GERENCIA },
  atencion: { correo: "valentina.castro@solucionescreativas.test", clave: entorno.SEED_PASSWORD_ATENCION_CLIENTE },
  operaciones: { correo: "karla.reyes@solucionescreativas.test", clave: entorno.SEED_PASSWORD_OPERACIONES },
};

async function sesion(navegador, perfil, ancho, alto) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, locale: "es-NI" });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (mensaje) => { if (mensaje.type() === "error") errores.push(mensaje.text()); });
  await pagina.goto(`${base}/login`);
  await pagina.getByLabel("Correo electrónico").fill(perfil.correo);
  await pagina.locator("#contrasena").fill(perfil.clave);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  return { contexto, pagina, errores };
}

const navegador = await chromium.launch();
const informe = [];
for (const [nombre, ancho, alto] of [["1366", 1366, 900], ["1024", 1024, 900], ["768", 768, 1100]]) {
  for (const perfil of ["gerencia", "atencion", "operaciones"]) {
    const { contexto, pagina, errores } = await sesion(navegador, perfiles[perfil], ancho, alto);
    await pagina.goto(`${base}/panel`); await pagina.waitForTimeout(900);
    await pagina.screenshot({ path: path.join(salida, `panel-${perfil}-${nombre}.png`), fullPage: true });
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    informe.push({ vista: `panel-${perfil}-${nombre}`, desborde, errores: [...errores] });
    await contexto.close();
  }
}
const { contexto, pagina, errores } = await sesion(navegador, perfiles.atencion, 1366, 900);
await pagina.goto(`${base}/cotizaciones`); await pagina.waitForTimeout(500);
const peticionesRsc = [];
pagina.on("request", (peticion) => { if (peticion.url().includes("/cotizaciones") && peticion.headers()["rsc"]) peticionesRsc.push(peticion.url()); });
await pagina.getByRole("button", { name: "Nueva cotización" }).first().click();
await pagina.getByRole("dialog").waitFor(); await pagina.waitForTimeout(700);
await pagina.screenshot({ path: path.join(salida, "drawer-cotizacion.png") });
await pagina.getByLabel("Asunto").fill("Rótulo de prueba del drawer");
await pagina.getByRole("button", { name: "Nuevo cliente" }).click(); await pagina.waitForTimeout(400);
await pagina.screenshot({ path: path.join(salida, "modal-cliente.png") });
await pagina.keyboard.press("Escape"); await pagina.waitForTimeout(300);
const asunto = await pagina.getByLabel("Asunto").inputValue();
const cuerpoBloqueado = await pagina.evaluate(() => getComputedStyle(document.body).pointerEvents);
await pagina.getByRole("button", { name: "Cancelar" }).last().click(); await pagina.waitForTimeout(400);
const cuerpoTrasCerrar = await pagina.evaluate(() => getComputedStyle(document.body).pointerEvents);
informe.push({ vista: "drawer", asuntoConservado: asunto, cuerpoConDrawer: cuerpoBloqueado, cuerpoTrasCerrar, url: pagina.url(), peticionesRsc, errores: [...errores] });
await contexto.close();
await navegador.close();
console.log(JSON.stringify(informe, null, 1));
