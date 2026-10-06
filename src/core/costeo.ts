import { AppError, type CamposError } from "@/lib/errores";

import {
  CERO,
  CIEN,
  UNO,
  comparar,
  deEntero,
  dividir,
  formatear,
  leerDecimal,
  multiplicar,
  redondear,
  restar,
  sumar,
  tieneEscala,
  type Racional,
} from "./decimal";

// Motor de costeo variable (CF-10, R-03). Fuente única de las fórmulas de cotización.
// Reproduce los CHECK de prisma/sql/restricciones.sql y docs/modulos/02-costeo.md las documenta.

export type TipoLineaCosto = "MATERIAL" | "MANO_OBRA" | "TERCERO";
export type TipoItem = "CATALOGO" | "PERSONALIZADO";
export type UnidadCobro = "UNIDAD" | "M2";

export type EntradaLinea =
  | { tipo: "MATERIAL"; cantidad: string; costoUnitario: string; mermaPct: string }
  | { tipo: "MANO_OBRA"; horas: string; tarifa: string }
  | { tipo: "TERCERO"; costo: string };

/** Valores listos para las columnas de linea_costo. */
export type LineaCosteada = {
  tipo: TipoLineaCosto;
  cantidad: string;
  costoUnitario: string;
  mermaPct: string;
  importe: string;
};

export type EntradaItemPersonalizado = { cantidad: string; margenPct: string; lineas: EntradaLinea[] };

export type EntradaItemCatalogo = {
  unidadCobro: UnidadCobro;
  precioBase: string;
  cantidad: string;
  ancho?: string | null;
  alto?: string | null;
};

/** Valores listos para las columnas de item_cotizacion. */
export type ItemPersonalizadoCosteado = {
  tipo: "PERSONALIZADO";
  cantidad: string;
  precioUnitario: string;
  costoTotal: string;
  margenPct: string;
  importe: string;
  lineas: LineaCosteada[];
};

export type ItemCatalogoCosteado = {
  tipo: "CATALOGO";
  unidadCobro: UnidadCobro;
  cantidad: string;
  ancho: string | null;
  alto: string | null;
  precioUnitario: string;
  costoTotal: null;
  margenPct: null;
  importe: string;
};

/** Lo mínimo de un ítem para totalizar. Acepta los ítems costeados o filas leídas de la base. */
export type ItemTotalizable = { tipo: TipoItem; importe: string; costoTotal: string | null };

export type EntradaCotizacion = { items: ItemTotalizable[]; descuento: string; tasaImpuesto: string };

/** Valores listos para las columnas de cotizacion. margenPct es nulo sin ítems personalizados. */
export type TotalesCotizacion = {
  subtotal: string;
  descuento: string;
  tasaImpuesto: string;
  impuesto: string;
  total: string;
  margenPct: string | null;
};

type Columna = { decimales: number; enteros: number };
type Rango = "positivo" | "noNegativo" | "hasta100" | "menorQue100";
type Campo = Columna & { rango: Rango };

// Precisión de las columnas numeric(p, s) de prisma/schema.prisma: enteros = p - s.
const CANTIDAD: Columna = { decimales: 3, enteros: 11 };
const COSTO_UNITARIO: Columna = { decimales: 4, enteros: 10 };
const MONTO: Columna = { decimales: 2, enteros: 12 };
const PORCENTAJE: Columna = { decimales: 2, enteros: 3 };

const CANTIDAD_POSITIVA: Campo = { ...CANTIDAD, rango: "positivo" };
const COSTO: Campo = { ...COSTO_UNITARIO, rango: "noNegativo" };
const MONTO_NO_NEGATIVO: Campo = { ...MONTO, rango: "noNegativo" };
const MERMA: Campo = { ...PORCENTAJE, rango: "hasta100" };
const TASA: Campo = { ...PORCENTAJE, rango: "hasta100" };
const MARGEN: Campo = { ...PORCENTAJE, rango: "menorQue100" };

const MENSAJE_RANGO: Record<Rango, string> = {
  positivo: "Debe ser mayor que 0.",
  noNegativo: "No puede ser negativo.",
  hasta100: "Debe estar entre 0 y 100.",
  menorQue100: "Debe ser mayor o igual que 0 y menor que 100.",
};

function cabe(valor: Racional, columna: Columna): boolean {
  const limite = deEntero(10 ** columna.enteros);
  return comparar(valor, limite) < 0 && comparar(valor, restar(CERO, limite)) > 0;
}

function cumpleRango(valor: Racional, rango: Rango): boolean {
  if (rango === "positivo") return comparar(valor, CERO) > 0;
  if (comparar(valor, CERO) < 0) return false;
  if (rango === "hasta100") return comparar(valor, CIEN) <= 0;
  if (rango === "menorQue100") return comparar(valor, CIEN) < 0;
  return true;
}

function maximoDe({ enteros, decimales }: Columna): string {
  return `${"9".repeat(enteros)}.${"9".repeat(decimales)}`;
}

// Rechaza decimales de más en vez de redondearlos: la base los redondearía en silencio.
function interpretar(texto: unknown, campo: Campo): Racional | string {
  if (typeof texto !== "string" || texto === "") return "Es obligatorio.";
  const valor = leerDecimal(texto);
  if (!valor) return "Debe ser un número decimal con punto, por ejemplo 12.50.";
  if (!cumpleRango(valor, campo.rango)) return MENSAJE_RANGO[campo.rango];
  if (!tieneEscala(valor, campo.decimales)) return `Admite hasta ${campo.decimales} decimales.`;
  if (!cabe(valor, campo)) return `No puede superar ${maximoDe(campo)}.`;
  return valor;
}

// Reúne los errores por campo para responder 422 con todos a la vez.
class Lector {
  readonly errores: CamposError = {};

  leer(ruta: string, texto: unknown, campo: Campo): Racional {
    const resultado = interpretar(texto, campo);
    if (typeof resultado !== "string") return resultado;
    this.rechazar(ruta, resultado);
    return CERO;
  }

  rechazar(ruta: string, mensaje: string): void {
    this.errores[ruta] ??= mensaje;
  }

  // Un resultado fuera de su columna haría fallar el INSERT por desbordamiento numérico.
  monto(ruta: string, valor: Racional): string {
    if (!cabe(redondear(valor, MONTO.decimales), MONTO)) {
      this.rechazar(ruta, `El resultado supera el máximo admitido (${maximoDe(MONTO)}).`);
    }
    return formatear(valor, MONTO.decimales);
  }

  get hayErrores(): boolean {
    return Object.keys(this.errores).length > 0;
  }
}

type Calculo<E, S> = (lector: Lector, entrada: E) => S;

function ejecutar<E, S>(calcular: Calculo<E, S>, entrada: E): S {
  const lector = new Lector();
  const salida = calcular(lector, entrada);
  if (lector.hayErrores) {
    throw new AppError({ codigo: "VALIDACION", mensaje: "Hay campos con errores.", status: 422, campos: lector.errores });
  }
  return salida;
}

function revisar<E, S>(calcular: Calculo<E, S>, entrada: E): CamposError {
  const lector = new Lector();
  calcular(lector, entrada);
  return lector.errores;
}

type LineaLeida = { cantidad: Racional; costoUnitario: Racional; mermaPct: Racional };

// MANO_OBRA guarda horas como cantidad y tarifa como costo. TERCERO es un servicio con cantidad 1.
function leerLinea(lector: Lector, entrada: EntradaLinea, prefijo: string): LineaLeida {
  const ruta = (campo: string) => `${prefijo}${campo}`;
  const tipo: string = entrada?.tipo;
  if (entrada?.tipo === "MATERIAL") {
    return {
      cantidad: lector.leer(ruta("cantidad"), entrada.cantidad, CANTIDAD_POSITIVA),
      costoUnitario: lector.leer(ruta("costoUnitario"), entrada.costoUnitario, COSTO),
      mermaPct: lector.leer(ruta("mermaPct"), entrada.mermaPct, MERMA),
    };
  }
  if (entrada?.tipo === "MANO_OBRA") {
    return {
      cantidad: lector.leer(ruta("horas"), entrada.horas, CANTIDAD_POSITIVA),
      costoUnitario: lector.leer(ruta("tarifa"), entrada.tarifa, COSTO),
      mermaPct: CERO,
    };
  }
  if (entrada?.tipo === "TERCERO") {
    return { cantidad: UNO, costoUnitario: lector.leer(ruta("costo"), entrada.costo, COSTO), mermaPct: CERO };
  }
  lector.rechazar(ruta("tipo"), `Tipo de línea desconocido (${tipo}). Usa MATERIAL, MANO_OBRA o TERCERO.`);
  return { cantidad: UNO, costoUnitario: CERO, mermaPct: CERO };
}

// importe = round(cantidad × costoUnitario × (1 + merma / 100), 2). CHECK linea_importe.
function calcularLinea(lector: Lector, entrada: EntradaLinea, prefijo = ""): LineaCosteada {
  const { cantidad, costoUnitario, mermaPct } = leerLinea(lector, entrada, prefijo);
  const factorMerma = sumar(UNO, dividir(mermaPct, CIEN));
  const importe = multiplicar(multiplicar(cantidad, costoUnitario), factorMerma);
  return {
    tipo: entrada?.tipo,
    cantidad: formatear(cantidad, CANTIDAD.decimales),
    costoUnitario: formatear(costoUnitario, COSTO_UNITARIO.decimales),
    mermaPct: formatear(mermaPct, PORCENTAJE.decimales),
    importe: lector.monto(`${prefijo}importe`, importe),
  };
}

function leerLineas(lector: Lector, lineas: unknown): EntradaLinea[] {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    lector.rechazar("lineas", "Agrega al menos una línea de costo.");
    return [];
  }
  return lineas;
}

// Margen sobre el precio de venta (D-15): importe = round(costoTotal / (1 − margen / 100), 2).
function calcularItemPersonalizado(lector: Lector, entrada: EntradaItemPersonalizado): ItemPersonalizadoCosteado {
  const lineas = leerLineas(lector, entrada.lineas).map((linea, i) => calcularLinea(lector, linea, `lineas.${i}.`));
  const cantidad = lector.leer("cantidad", entrada.cantidad, CANTIDAD_POSITIVA);
  const margen = lector.leer("margenPct", entrada.margenPct, MARGEN);
  // Suma de importes ya redondeados: el trigger de envío compara costo_total con esa suma.
  const costoTotal = lineas.reduce((suma, linea) => sumar(suma, leerDecimal(linea.importe) ?? CERO), CERO);
  const importe = redondear(dividir(costoTotal, restar(UNO, dividir(margen, CIEN))), MONTO.decimales);
  // Sin errores la cantidad es positiva; con errores no se divide.
  const precioUnitario = lector.hayErrores ? CERO : dividir(importe, cantidad);
  return {
    tipo: "PERSONALIZADO",
    cantidad: formatear(cantidad, CANTIDAD.decimales),
    precioUnitario: lector.monto("precioUnitario", precioUnitario),
    costoTotal: lector.monto("costoTotal", costoTotal),
    margenPct: formatear(margen, PORCENTAJE.decimales),
    importe: lector.monto("importe", importe),
    lineas,
  };
}

function leerMedida(lector: Lector, entrada: EntradaItemCatalogo, campo: "ancho" | "alto"): Racional | null {
  const texto = entrada[campo];
  if (texto != null) return lector.leer(campo, texto, CANTIDAD_POSITIVA);
  if (entrada.unidadCobro === "M2") lector.rechazar(campo, "Es obligatorio cuando se cobra por m2.");
  return null;
}

// UNIDAD: round(precio × cantidad, 2). M2: round(precio × ancho × alto × cantidad, 2). CHECK item_importe_catalogo.
function calcularItemCatalogo(lector: Lector, entrada: EntradaItemCatalogo): ItemCatalogoCosteado {
  const { unidadCobro } = entrada;
  if (unidadCobro !== "UNIDAD" && unidadCobro !== "M2") lector.rechazar("unidadCobro", "Usa UNIDAD o M2.");
  const precio = lector.leer("precioBase", entrada.precioBase, MONTO_NO_NEGATIVO);
  const cantidad = lector.leer("cantidad", entrada.cantidad, CANTIDAD_POSITIVA);
  const ancho = leerMedida(lector, entrada, "ancho");
  const alto = leerMedida(lector, entrada, "alto");
  const base = multiplicar(precio, cantidad);
  const superficie = unidadCobro === "M2" ? multiplicar(ancho ?? CERO, alto ?? CERO) : UNO;
  return {
    tipo: "CATALOGO",
    unidadCobro,
    cantidad: formatear(cantidad, CANTIDAD.decimales),
    ancho: ancho && formatear(ancho, CANTIDAD.decimales),
    alto: alto && formatear(alto, CANTIDAD.decimales),
    precioUnitario: formatear(precio, MONTO.decimales),
    costoTotal: null,
    margenPct: null,
    importe: lector.monto("importe", multiplicar(base, superficie)),
  };
}

type ItemLeido = { tipo: TipoItem; importe: Racional; costoTotal: Racional };

function leerItems(lector: Lector, items: unknown): ItemLeido[] {
  if (!Array.isArray(items)) {
    lector.rechazar("items", "Es obligatorio.");
    return [];
  }
  return items.map((item: ItemTotalizable, i) => {
    const personalizado = item?.tipo === "PERSONALIZADO";
    if (!personalizado && item?.tipo !== "CATALOGO") lector.rechazar(`items.${i}.tipo`, "Usa CATALOGO o PERSONALIZADO.");
    return {
      tipo: item?.tipo,
      importe: lector.leer(`items.${i}.importe`, item?.importe, MONTO_NO_NEGATIVO),
      costoTotal: personalizado ? lector.leer(`items.${i}.costoTotal`, item.costoTotal, MONTO_NO_NEGATIVO) : CERO,
    };
  });
}

// Margen resultante de los ítems personalizados: (Σ importe − Σ costo) / Σ importe × 100.
// El CHECK cotizacion_porcentajes exige 0 <= margen < 100 sobre el valor ya redondeado.
function margenResultante(lector: Lector, items: ItemLeido[]): string | null {
  if (lector.hayErrores) return null;
  const personalizados = items.filter((item) => item.tipo === "PERSONALIZADO");
  const importe = personalizados.reduce((suma, item) => sumar(suma, item.importe), CERO);
  if (comparar(importe, CERO) === 0) return null;
  const costo = personalizados.reduce((suma, item) => sumar(suma, item.costoTotal), CERO);
  const margen = redondear(multiplicar(dividir(restar(importe, costo), importe), CIEN), PORCENTAJE.decimales);
  const texto = formatear(margen, PORCENTAJE.decimales);
  if (comparar(margen, CERO) < 0 || comparar(margen, CIEN) >= 0) {
    lector.rechazar("items", `El margen resultante (${texto} %) debe estar entre 0 y menos de 100.`);
  }
  return texto;
}

// impuesto = round((subtotal − descuento) × tasa / 100, 2) y total = subtotal − descuento + impuesto.
// CHECK cotizacion_aritmetica y cotizacion_montos_no_negativos.
function calcularTotales(lector: Lector, entrada: EntradaCotizacion): TotalesCotizacion {
  const items = leerItems(lector, entrada.items);
  const subtotal = items.reduce((suma, item) => sumar(suma, item.importe), CERO);
  const descuento = lector.leer("descuento", entrada.descuento, MONTO_NO_NEGATIVO);
  const tasa = lector.leer("tasaImpuesto", entrada.tasaImpuesto, TASA);
  if (comparar(descuento, subtotal) > 0) {
    lector.rechazar("descuento", `No puede superar el subtotal (${formatear(subtotal, MONTO.decimales)}).`);
  }
  const neto = restar(subtotal, descuento);
  const impuesto = redondear(dividir(multiplicar(neto, tasa), CIEN), MONTO.decimales);
  return {
    subtotal: lector.monto("subtotal", subtotal),
    descuento: formatear(descuento, MONTO.decimales),
    tasaImpuesto: formatear(tasa, PORCENTAJE.decimales),
    impuesto: lector.monto("impuesto", impuesto),
    total: lector.monto("total", sumar(neto, impuesto)),
    margenPct: margenResultante(lector, items),
  };
}

/** Costea una línea. Lanza AppError 422 VALIDACION con los errores por campo. */
export function costearLinea(entrada: EntradaLinea): LineaCosteada {
  return ejecutar(calcularLinea, entrada);
}

export function validarLinea(entrada: EntradaLinea): CamposError {
  return revisar(calcularLinea, entrada);
}

/** Costea un ítem personalizado: suma de líneas y margen sobre el precio. Lanza AppError 422. */
export function costearItemPersonalizado(entrada: EntradaItemPersonalizado): ItemPersonalizadoCosteado {
  return ejecutar(calcularItemPersonalizado, entrada);
}

export function validarItemPersonalizado(entrada: EntradaItemPersonalizado): CamposError {
  return revisar(calcularItemPersonalizado, entrada);
}

/** Costea un ítem de catálogo por unidad o por m2. Lanza AppError 422. */
export function costearItemCatalogo(entrada: EntradaItemCatalogo): ItemCatalogoCosteado {
  return ejecutar(calcularItemCatalogo, entrada);
}

export function validarItemCatalogo(entrada: EntradaItemCatalogo): CamposError {
  return revisar(calcularItemCatalogo, entrada);
}

/** Totales y margen resultante de una cotización. Lanza AppError 422. */
export function totalizarCotizacion(entrada: EntradaCotizacion): TotalesCotizacion {
  return ejecutar(calcularTotales, entrada);
}

export function validarCotizacion(entrada: EntradaCotizacion): CamposError {
  return revisar(calcularTotales, entrada);
}
