// Renderiza un SVG a PNG en dos momentos de la animación: node render-svg.mjs <svg> <salida-base>
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.join("C:/Proyectos/sc-plataforma", "package.json"));
const { chromium } = require("@playwright/test");
const [svg, salida] = process.argv.slice(2);
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 360 } });
await pagina.goto(`file:///${path.resolve(svg).split(path.sep).join("/")}`);
await pagina.waitForTimeout(300); await pagina.screenshot({ path: `${salida}-inicio.png` });
await pagina.waitForTimeout(2500); await pagina.screenshot({ path: `${salida}-final.png` });
await navegador.close();
