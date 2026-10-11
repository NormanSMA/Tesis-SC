// Captura una URL en varios anchos. Uso: node scripts/captura-pagina.mjs <url> <carpeta-salida> <nombre>
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [url, salida, nombre] = process.argv.slice(2);
if (!url || !salida || !nombre) {
  console.error("Uso: node scripts/captura-pagina.mjs <url> <carpeta-salida> <nombre>");
  process.exit(1);
}
mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch();
for (const [etiqueta, ancho, alto] of [["escritorio", 1366, 800], ["tableta", 820, 1180], ["movil", 390, 844]]) {
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto } });
  await pagina.goto(url, { waitUntil: "networkidle" });
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`${etiqueta} ${ancho}px: desborde horizontal = ${desborde}`);
  await pagina.screenshot({ path: path.join(salida, `${nombre}-${etiqueta}.png`), fullPage: true });
  await pagina.close();
}
await navegador.close();
