// Captura una maqueta HTML en dos anchos. Uso: node scripts/captura-maqueta.mjs <archivo.html> <carpeta-salida>
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [archivo, salida] = process.argv.slice(2);
if (!archivo || !salida) {
  console.error("Uso: node scripts/captura-maqueta.mjs <archivo.html> <carpeta-salida>");
  process.exit(1);
}
mkdirSync(salida, { recursive: true });
const nombre = path.basename(archivo, ".html");
const navegador = await chromium.launch();
for (const [etiqueta, ancho, alto] of [["escritorio", 1366, 900], ["movil", 390, 900]]) {
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto } });
  await pagina.goto(pathToFileURL(path.resolve(archivo)).href);
  await pagina.screenshot({ path: path.join(salida, `${nombre}-${etiqueta}.png`), fullPage: true });
  await pagina.close();
}
await navegador.close();
