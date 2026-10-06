const IMAGENES: Readonly<Record<string, string>> = {
  "rotulacion y gran formato": "lona-publicitaria",
  "impresion y artes graficas": "impresora-gran-formato",
  "diseno y branding": "tarjetas",
  "publicidad digital y medios": "roll-up",
  "articulos promocionales": "etiquetas",
  "letras corporeas y rotulos luminosos": "rotulo-rigido",
  "corte y grabado laser": "plotter-de-corte",
  mobiliario: "entrega",
};

export function imagenPorCategoria(categoria: string): string {
  const nombre = categoria.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return `/seed/productos/${IMAGENES[nombre] ?? "entrega"}.webp`;
}
