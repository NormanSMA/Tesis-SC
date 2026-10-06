import { existsSync } from "node:fs";
import path from "node:path";
import { getSharp } from "next/dist/server/image-optimizer";
import { expect, it } from "vitest";

import { imagenPorCategoria } from "@/modules/catalogo/imagenes";

const casos = [
  ["Rotulación y gran formato", "lona-publicitaria"], ["Impresión y artes gráficas", "impresora-gran-formato"],
  ["Diseño y branding", "tarjetas"], ["Publicidad digital y medios", "roll-up"], ["Artículos promocionales", "etiquetas"],
  ["Letras corpóreas y rótulos luminosos", "rotulo-rigido"], ["Corte y grabado láser", "plotter-de-corte"],
  ["Mobiliario", "entrega"], ["Otra categoría", "entrega"],
];
it.each(casos)("asigna imagen a %s sin tildes ni distinción de mayúsculas", (categoria, archivo) => {
  const esperada = `/seed/productos/${archivo}.webp`;
  expect(imagenPorCategoria(categoria)).toBe(esperada);
  expect(imagenPorCategoria(categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())).toBe(esperada);
});
it("los ocho archivos existen y tienen 640 por 640 píxeles", async () => {
  for (const archivo of new Set(casos.map(([, archivo]) => archivo))) {
    const ruta = path.join("public", "seed", "productos", `${archivo}.webp`);
    expect(existsSync(ruta)).toBe(true);
    expect(await getSharp(undefined, undefined)(ruta).metadata()).toMatchObject({ width: 640, height: 640, format: "webp" });
  }
});
