#!/usr/bin/env node
// CLI de capturas. Uso: node scripts/capturas/cli.mjs <subcomando> [opciones]   (ver --help)
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import {
  BASE_POR_DEFECTO, PERFILES, RAIZ, abrirNavegador, crearContexto, iniciarSesion, medirDesborde, nombreDeRuta,
} from "./comun.mjs";

const AYUDA = `Uso: node scripts/capturas/cli.mjs <subcomando> [opciones]

Subcomandos:
  pantallas   Rutas de un perfil a un ancho.   --perfil <p> [--ancho 1366] --rutas /a,/b
  paneles     Panel de cada perfil.            [--ancho 1366]
  recorrido   Pantallas clave y primera ficha de cada perfil en escritorio y móvil.
  pagina      Una URL en tres anchos.          <url> <nombre>
  maqueta     Un HTML local en dos anchos.     <archivo.html>
  desborde    Mide desborde horizontal.        --perfil <p> [--ancho 1366] --rutas /a,/b

Opciones comunes:
  --base <url>     URL base de la app (por defecto ${BASE_POR_DEFECTO})
  --salida <dir>   Carpeta de salida (por defecto docs/capturas/<subcomando>)
  --perfil <p>     ${Object.keys(PERFILES).join(", ")}
  --rutas <lista>  Rutas separadas por coma (se puede repetir)
  --ancho <px>     Ancho del viewport (por defecto 1366)
  -h, --help       Muestra esta ayuda`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: BASE_POR_DEFECTO },
    salida: { type: "string" },
    perfil: { type: "string" },
    rutas: { type: "string", multiple: true },
    ancho: { type: "string", default: "1366" },
    help: { type: "boolean", short: "h" },
  },
});
const [subcomando, ...args] = positionals;

function fallar(mensaje) {
  console.error(mensaje);
  process.exit(1);
}

const ancho = Number(values.ancho);
if (!Number.isInteger(ancho) || ancho <= 0) fallar(`Ancho inválido: ${values.ancho}`);
const rutas = (values.rutas ?? []).flatMap((texto) => texto.split(",")).map((ruta) => ruta.trim()).filter(Boolean);
const base = values.base.replace(/\/$/, "");

// Carpeta de salida resuelta desde la raíz del repo; se crea al pedirla.
function carpetaSalida() {
  const carpeta = path.resolve(RAIZ, values.salida ?? path.join("docs", "capturas", subcomando));
  mkdirSync(carpeta, { recursive: true });
  return carpeta;
}

function exigirPerfilYRutas() {
  if (!values.perfil || !(values.perfil in PERFILES)) fallar(`Indique --perfil (${Object.keys(PERFILES).join(", ")}).`);
  if (rutas.length === 0) fallar("Indique --rutas, por ejemplo --rutas /panel,/clientes.");
}

async function conNavegador(tarea) {
  const navegador = await abrirNavegador();
  try {
    await tarea(navegador);
  } finally {
    await navegador.close();
  }
}

async function pantallas() {
  exigirPerfilYRutas();
  const salida = carpetaSalida();
  await conNavegador(async (navegador) => {
    const contexto = await crearContexto(navegador, ancho);
    const pagina = await contexto.newPage();
    await iniciarSesion(pagina, base, values.perfil);
    for (const ruta of rutas) {
      await pagina.goto(`${base}${ruta}`);
      await pagina.waitForTimeout(1000);
      const nombre = nombreDeRuta(ruta);
      await pagina.screenshot({ path: path.join(salida, `${values.perfil}-${nombre}-${ancho}.png`), fullPage: true });
      console.log(`${nombre} ${(await medirDesborde(pagina)) > 0 ? "DESBORDA" : "ok"}`);
    }
  });
}

async function paneles() {
  const salida = carpetaSalida();
  await conNavegador(async (navegador) => {
    for (const [indice, [perfil, datos]] of Object.entries(PERFILES).entries()) {
      const contexto = await crearContexto(navegador, ancho);
      const pagina = await contexto.newPage();
      await iniciarSesion(pagina, base, perfil);
      if (!datos.sinPanel) await pagina.goto(`${base}/panel`);
      await pagina.waitForTimeout(1200);
      await pagina.screenshot({ path: path.join(salida, `panel-${indice + 1}-${perfil}-${ancho}.png`), fullPage: true });
      console.log(perfil, (await medirDesborde(pagina)) > 0 ? "DESBORDA" : "ok");
      await contexto.close();
    }
  });
}

const ANCHOS_RECORRIDO = [["escritorio", 1366, 860], ["movil", 390, 844]];
const FICHAS = [["/clientes", /\/clientes\/[0-9a-f-]{36}$/], ["/cotizaciones", /\/cotizaciones\/[0-9a-f-]{36}$/],
  ["/ordenes", /\/ordenes\/[0-9a-f-]{36}$/], ["/catalogo", /\/catalogo\/[0-9a-f-]{36}$/]];

async function recorrido() {
  const salida = carpetaSalida();
  await conNavegador(async (navegador) => {
    for (const [perfil, datos] of Object.entries(PERFILES)) {
      for (const [etiqueta, anchoVista, alto] of ANCHOS_RECORRIDO) {
        const contexto = await crearContexto(navegador, anchoVista, { alto, reducirMovimiento: true });
        const pagina = await contexto.newPage();
        await iniciarSesion(pagina, base, perfil);
        for (const ruta of datos.rutas) {
          await pagina.goto(`${base}${ruta}`, { waitUntil: "networkidle" });
          const desborde = (await medirDesborde(pagina)) > 0;
          await pagina.screenshot({ path: path.join(salida, `${perfil}${ruta.replaceAll("/", "-")}-${etiqueta}.png`), fullPage: true });
          console.log(`${perfil} ${ruta} ${etiqueta}: desborde=${desborde}`);
        }
        // Primera ficha de la lista principal para los perfiles con acceso.
        for (const [lista, patron] of FICHAS) {
          if (!datos.rutas.includes(lista)) continue;
          await pagina.goto(`${base}${lista}`, { waitUntil: "networkidle" });
          const enlace = pagina.locator(`a[href^="${lista}/"]:not([href$="/nuevo"]):not([href$="/nueva"])`).first();
          if ((await enlace.count()) === 0) continue;
          await enlace.click();
          await pagina.waitForURL(patron, { timeout: 15000 }).catch(() => null);
          await pagina.waitForLoadState("networkidle");
          await pagina.waitForFunction(() => !document.querySelector(".animate-pulse, [data-slot=skeleton]"), null, { timeout: 15000 }).catch(() => null);
          await pagina.waitForTimeout(300);
          const desborde = (await medirDesborde(pagina)) > 0;
          await pagina.screenshot({ path: path.join(salida, `${perfil}-ficha${lista.replaceAll("/", "-")}-${etiqueta}.png`), fullPage: true });
          console.log(`${perfil} ficha ${lista} ${etiqueta}: desborde=${desborde}`);
        }
        await contexto.close();
      }
    }
  });
}

async function urlEnAnchos() {
  const [url, nombre] = args;
  if (!url || !nombre) fallar("Uso: pagina <url> <nombre> [--salida <dir>]");
  const salida = carpetaSalida();
  await conNavegador(async (navegador) => {
    for (const [etiqueta, anchoVista, alto] of [["escritorio", 1366, 800], ["tableta", 820, 1180], ["movil", 390, 844]]) {
      const contexto = await crearContexto(navegador, anchoVista, { alto });
      const hoja = await contexto.newPage();
      await hoja.goto(url, { waitUntil: "networkidle" });
      console.log(`${etiqueta} ${anchoVista}px: desborde horizontal = ${(await medirDesborde(hoja)) > 0}`);
      await hoja.screenshot({ path: path.join(salida, `${nombre}-${etiqueta}.png`), fullPage: true });
      await contexto.close();
    }
  });
}

async function maqueta() {
  const [archivo] = args;
  if (!archivo) fallar("Uso: maqueta <archivo.html> [--salida <dir>]");
  const salida = carpetaSalida();
  const nombre = path.basename(archivo, ".html");
  await conNavegador(async (navegador) => {
    for (const [etiqueta, anchoVista, alto] of [["escritorio", 1366, 900], ["movil", 390, 900]]) {
      const contexto = await crearContexto(navegador, anchoVista, { alto });
      const hoja = await contexto.newPage();
      await hoja.goto(pathToFileURL(path.resolve(archivo)).href);
      await hoja.screenshot({ path: path.join(salida, `${nombre}-${etiqueta}.png`), fullPage: true });
      await contexto.close();
    }
  });
}

async function medirRutas() {
  exigirPerfilYRutas();
  await conNavegador(async (navegador) => {
    const contexto = await crearContexto(navegador, ancho);
    const hoja = await contexto.newPage();
    await iniciarSesion(hoja, base, values.perfil);
    for (const ruta of rutas) {
      await hoja.goto(`${base}${ruta}`);
      await hoja.waitForTimeout(1000);
      const sobra = await medirDesborde(hoja);
      console.log(sobra > 0 ? `DESBORDE ${sobra}px ${ruta} ${ancho}` : `${nombreDeRuta(ruta)} ok`);
    }
  });
}

const SUBCOMANDOS = { pantallas, paneles, recorrido, pagina: urlEnAnchos, maqueta, desborde: medirRutas };

if (values.help || !subcomando) {
  console.log(AYUDA);
  process.exit(values.help ? 0 : 1);
}
if (!(subcomando in SUBCOMANDOS)) fallar(`Subcomando desconocido: ${subcomando}\n\n${AYUDA}`);
try {
  await SUBCOMANDOS[subcomando]();
} catch (error) {
  fallar(error instanceof Error ? error.message : String(error));
}
