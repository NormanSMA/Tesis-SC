import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";

import { imagenPorCategoria } from "@/modules/catalogo/imagenes";

const casos = [
  ["Rotulación y gran formato", "lona-publicitaria"], ["Impresión y artes gráficas", "impresora-gran-formato"],
  ["Diseño y branding", "tarjetas"], ["Publicidad digital y medios", "roll-up"], ["Artículos promocionales", "etiquetas"],
  ["Letras corpóreas y rótulos luminosos", "rotulo-rigido"], ["Corte y grabado láser", "grabado-laser"],
  ["Mobiliario", "mueble-exhibidor"], ["Otra categoría", "lona-publicitaria"],
];
const archivos = [...new Set(casos.map(([, archivo]) => archivo))];
const ruta = (archivo: string) => path.join("public", "seed", "productos", `${archivo}.webp`);

it.each(casos)("asigna imagen a %s sin tildes ni distinción de mayúsculas", (categoria, archivo) => {
  const esperada = `/seed/productos/${archivo}.webp`;
  expect(imagenPorCategoria(categoria)).toBe(esperada);
  expect(imagenPorCategoria(categoria.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase())).toBe(esperada);
});
it("los ocho archivos existen y tienen 640 por 640 píxeles", async () => {
  expect(archivos).toHaveLength(8);
  for (const archivo of archivos) {
    expect(existsSync(ruta(archivo))).toBe(true);
    expect(await sharp(ruta(archivo)).metadata()).toMatchObject({ width: 640, height: 640, format: "webp" });
  }
});
// La paleta de marca es azul marino y grises (docs/diseno.md). El verde anterior (#108078) tiene tono 176°.
it.each(archivos)("%s no tiene píxeles verdes", async (archivo) => {
  const { data } = await sharp(ruta(archivo)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let verdes = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const maximo = Math.max(r, g, b), diferencia = maximo - Math.min(r, g, b);
    if (maximo <= 40 || diferencia / maximo <= 0.25) continue;
    const tono = maximo === g ? 60 * ((b - r) / diferencia + 2) : maximo === b ? 60 * ((r - g) / diferencia + 4) : -1;
    if (tono >= 140 && tono <= 190) verdes++;
  }
  expect(verdes).toBe(0);
});
