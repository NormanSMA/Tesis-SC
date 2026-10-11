// Recorrido visual por perfil. Inicia sesión con cada perfil y captura sus pantallas clave en dos anchos.
// Uso: node scripts/captura-recorrido.mjs <carpeta-salida> [base]   (claves SEED_PASSWORD_* en el entorno)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const salida = process.argv[2] ?? "docs/capturas/recorrido";
const base = process.argv[3] ?? "http://127.0.0.1:3000";

const PERFILES = [
  { codigo: "GERENCIA", correo: "gerardo.jimenez@solucionescreativas.test", clave: "SEED_PASSWORD_GERENCIA",
    rutas: ["/panel", "/clientes", "/cotizaciones", "/ordenes", "/inventario", "/reportes", "/trazabilidad"] },
  { codigo: "OPERACIONES", correo: "karla.reyes@solucionescreativas.test", clave: "SEED_PASSWORD_OPERACIONES",
    rutas: ["/panel", "/ordenes", "/catalogo", "/produccion"] },
  { codigo: "ATENCION_CLIENTE", correo: "valentina.castro@solucionescreativas.test", clave: "SEED_PASSWORD_ATENCION_CLIENTE",
    rutas: ["/panel", "/clientes", "/cotizaciones", "/catalogo"] },
  { codigo: "PRODUCCION", correo: "marco.lopez@solucionescreativas.test", clave: "SEED_PASSWORD_PRODUCCION",
    rutas: ["/panel", "/produccion"] },
  { codigo: "ADMINISTRACION", correo: "luis.mendoza@solucionescreativas.test", clave: "SEED_PASSWORD_ADMINISTRACION",
    rutas: ["/panel", "/inventario"] },
  { codigo: "ADMIN", correo: "roberto.diaz@solucionescreativas.test", clave: "SEED_PASSWORD_ADMIN",
    rutas: ["/admin/usuarios", "/admin/permisos", "/admin/configuracion"] },
];
const ANCHOS = [["escritorio", 1366, 860], ["movil", 390, 844]];

mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch();
for (const perfil of PERFILES) {
  const clave = process.env[perfil.clave];
  if (!clave) { console.error(`Falta ${perfil.clave}`); process.exit(1); }
  for (const [etiqueta, ancho, alto] of ANCHOS) {
    const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, locale: "es-NI", reducedMotion: "reduce" });
    const pagina = await contexto.newPage();
    await pagina.goto(`${base}/login`);
    await pagina.getByLabel("Correo electrónico").fill(perfil.correo);
    await pagina.locator("#contrasena").fill(clave);
    await pagina.getByRole("button", { name: "Ingresar" }).click();
    await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
    for (const ruta of perfil.rutas) {
      await pagina.goto(`${base}${ruta}`, { waitUntil: "networkidle" });
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      const nombre = `${perfil.codigo.toLowerCase()}${ruta.replaceAll("/", "-")}-${etiqueta}.png`;
      await pagina.screenshot({ path: path.join(salida, nombre), fullPage: true });
      console.log(`${perfil.codigo} ${ruta} ${etiqueta}: desborde=${desborde}`);
    }
    // Primera ficha de la lista principal para los perfiles con acceso.
    for (const [lista, patron] of [["/clientes", /\/clientes\/[0-9a-f-]{36}$/], ["/cotizaciones", /\/cotizaciones\/[0-9a-f-]{36}$/],
      ["/ordenes", /\/ordenes\/[0-9a-f-]{36}$/], ["/catalogo", /\/catalogo\/[0-9a-f-]{36}$/]]) {
      if (!perfil.rutas.includes(lista)) continue;
      await pagina.goto(`${base}${lista}`, { waitUntil: "networkidle" });
      const enlace = pagina.locator(`a[href^="${lista}/"]:not([href$="/nuevo"]):not([href$="/nueva"])`).first();
      if ((await enlace.count()) === 0) continue;
      await enlace.click();
      await pagina.waitForURL(patron, { timeout: 15000 }).catch(() => null);
      await pagina.waitForLoadState("networkidle");
      await pagina.waitForFunction(() => !document.querySelector(".animate-pulse, [data-slot=skeleton]"), null, { timeout: 15000 }).catch(() => null);
      await pagina.waitForTimeout(300);
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      await pagina.screenshot({ path: path.join(salida, `${perfil.codigo.toLowerCase()}-ficha${lista.replaceAll("/", "-")}-${etiqueta}.png`), fullPage: true });
      console.log(`${perfil.codigo} ficha ${lista} ${etiqueta}: desborde=${desborde}`);
    }
    await contexto.close();
  }
}
await navegador.close();
