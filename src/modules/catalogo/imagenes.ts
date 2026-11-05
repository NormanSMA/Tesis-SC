// Una imagen por categoría (public/seed/productos). Especificación de color y encuadre en docs/diseno.md.
const IMAGENES: Readonly<Record<string, string>> = {
  "rotulacion y gran formato": "lona-publicitaria",
  "impresion y artes graficas": "impresora-gran-formato",
  "diseno y branding": "tarjetas",
  "publicidad digital y medios": "roll-up",
  "articulos promocionales": "etiquetas",
  "letras corporeas y rotulos luminosos": "rotulo-rigido",
  "corte y grabado laser": "grabado-laser",
  mobiliario: "mueble-exhibidor",
};
/** Categorías nuevas sin imagen propia: rotulación es el servicio principal de la empresa. */
const POR_DEFECTO = "lona-publicitaria";

export function imagenPorCategoria(categoria: string): string {
  const nombre = categoria.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return `/seed/productos/${IMAGENES[nombre] ?? POR_DEFECTO}.webp`;
}
