// Ilustraciones de los servicios de Soluciones Creativas (public/seed/servicios, tomadas de s-creativas.net/servicios).
// Cada categoría del catálogo se asocia a una ilustración. Sin coincidencia no se muestra ilustración.

export type ServicioVisual = { slug: string; nombre: string };

export const SERVICIOS: Readonly<Record<string, string>> = {
  "marketing-digital": "Marketing digital",
  "uv-dtf": "Impresión UV-DTF",
  "gran-formato": "Impresión a gran formato",
  rotulacion: "Rotulación",
  "corte-grabado-laser": "Corte y grabado láser",
  bordado: "Bordado computarizado",
  "letras-corporeas": "Letras corpóreas",
  "sublimacion-serigrafia": "Sublimación y serigrafía",
  muebles: "Muebles metálicos y melamina",
  vallas: "Renta y fabricación de vallas",
  senalizacion: "Señalización vial y empresarial",
  reconocimientos: "Reconocimientos empresariales y deportivos",
  "video-marketing": "Video marketing",
};

const POR_CATEGORIA: Readonly<Record<string, string>> = {
  "rotulacion y gran formato": "rotulacion",
  "impresion y artes graficas": "gran-formato",
  "diseno y branding": "marketing-digital",
  "publicidad digital y medios": "video-marketing",
  "articulos promocionales": "sublimacion-serigrafia",
  "letras corporeas y rotulos luminosos": "letras-corporeas",
  "corte y grabado laser": "corte-grabado-laser",
  mobiliario: "muebles",
};

// Palabras clave para categorías nuevas que el administrador cree después.
const PALABRAS: readonly (readonly [RegExp, string])[] = [
  [/rotul|vinil|fachada/, "rotulacion"],
  [/gran formato|lona|impres/, "gran-formato"],
  [/laser|grabado|corte/, "corte-grabado-laser"],
  [/letra|corporea|luminos/, "letras-corporeas"],
  [/sublim|serigraf|promocional/, "sublimacion-serigrafia"],
  [/bordad|textil|uniforme/, "bordado"],
  [/mueble|mobiliario|melamina|exhibidor/, "muebles"],
  [/valla/, "vallas"],
  [/senal|vial/, "senalizacion"],
  [/reconocimiento|trofeo|premio/, "reconocimientos"],
  [/video|audiovisual|medios/, "video-marketing"],
  [/marketing|digital|dise|brand/, "marketing-digital"],
];

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function servicioDeCategoria(categoria: string): ServicioVisual | null {
  const nombre = normalizar(categoria);
  const slug = POR_CATEGORIA[nombre] ?? PALABRAS.find(([patron]) => patron.test(nombre))?.[1];
  return slug ? { slug, nombre: SERVICIOS[slug] } : null;
}

export function rutaServicio(slug: string): string {
  return `/seed/servicios/${slug}.webp`;
}
