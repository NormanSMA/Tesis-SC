// Piezas compartidas de los scripts de captura: cuentas, claves, login, contexto y desborde.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BASE_POR_DEFECTO = "http://127.0.0.1:3000";

// Perfiles: usuario, variable de clave y rutas del recorrido. El perfil admin no tiene /panel.
export const PERFILES = {
  gerencia: { usuario: "gerardo.jimenez", clave: "SEED_PASSWORD_GERENCIA",
    rutas: ["/panel", "/clientes", "/cotizaciones", "/ordenes", "/inventario", "/reportes", "/trazabilidad"] },
  atencion: { usuario: "valentina.castro", clave: "SEED_PASSWORD_ATENCION_CLIENTE",
    rutas: ["/panel", "/clientes", "/cotizaciones", "/catalogo"] },
  operaciones: { usuario: "karla.reyes", clave: "SEED_PASSWORD_OPERACIONES",
    rutas: ["/panel", "/ordenes", "/catalogo", "/produccion"] },
  produccion: { usuario: "marco.lopez", clave: "SEED_PASSWORD_PRODUCCION", rutas: ["/panel", "/produccion"] },
  administracion: { usuario: "luis.mendoza", clave: "SEED_PASSWORD_ADMINISTRACION", rutas: ["/panel", "/inventario"] },
  admin: { usuario: "roberto.diaz", clave: "SEED_PASSWORD_ADMIN",
    rutas: ["/admin/usuarios", "/admin/permisos", "/admin/configuracion"], sinPanel: true },
};

// Claves SEED_PASSWORD_*: el entorno manda; .env.example completa lo que falte.
function leerClaves() {
  const claves = {};
  const archivo = path.join(RAIZ, ".env.example");
  if (existsSync(archivo)) {
    for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
      if (!linea.startsWith("SEED_PASSWORD_") || !linea.includes("=")) continue;
      const corte = linea.indexOf("=");
      claves[linea.slice(0, corte).trim()] = linea.slice(corte + 1).trim().replace(/^"|"$/g, "");
    }
  }
  for (const [nombre, valor] of Object.entries(process.env)) {
    if (nombre.startsWith("SEED_PASSWORD_") && valor) claves[nombre] = valor;
  }
  return claves;
}

export function cuentaDe(perfil) {
  const datos = PERFILES[perfil];
  if (!datos) throw new Error(`Perfil desconocido: ${perfil}. Válidos: ${Object.keys(PERFILES).join(", ")}`);
  const clave = leerClaves()[datos.clave];
  if (!clave) throw new Error(`Falta ${datos.clave} en el entorno y en .env.example`);
  return { correo: `${datos.usuario}@solucionescreativas.test`, clave };
}

export function abrirNavegador() {
  return chromium.launch();
}

// Contexto es-NI. Con ancho menor a 500 emula móvil con toque.
export function crearContexto(navegador, ancho, { alto, reducirMovimiento = false } = {}) {
  const movil = ancho < 500;
  return navegador.newContext({
    viewport: { width: ancho, height: alto ?? (movil ? 844 : 900) },
    isMobile: movil,
    hasTouch: movil,
    locale: "es-NI",
    ...(reducirMovimiento ? { reducedMotion: "reduce" } : {}),
  });
}

export async function iniciarSesion(pagina, base, perfil) {
  const { correo, clave } = cuentaDe(perfil);
  await pagina.goto(`${base}/login`);
  await pagina.getByLabel("Correo electrónico").fill(correo);
  await pagina.locator("#contrasena").fill(clave);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}

// Píxeles de contenido que sobran a la derecha del viewport (0 si no hay desborde).
export function medirDesborde(pagina) {
  return pagina.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

export function nombreDeRuta(ruta) {
  return ruta.replace(/^\//, "").replace(/[/?=&]+/g, "-") || "inicio";
}
