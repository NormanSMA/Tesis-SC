// Cálculos de costeo y totales de cotización. Funciones puras con aritmética decimal exacta.
// Reproducen las fórmulas de los CHECK de prisma/sql/restricciones.sql (cotizacion_aritmetica,
// item_importe_catalogo, linea_importe). Redondean como round(numeric, n) de PostgreSQL:
// mitad hacia arriba en valor absoluto. Un módulo de costeo posterior debe dar los mismos resultados.
// Entradas y salidas son cadenas decimales para no pasar por números de punto flotante.

export type Decimal = string | number;
export type UnidadCobroCalculo = "UNIDAD" | "M2";

type Fraccion = { num: bigint; den: bigint };

// El target ES2017 del proyecto no admite literales bigint (0n): se construyen con BigInt().
const CERO_B = BigInt(0);
const UNO_B = BigInt(1);
const DOS_B = BigInt(2);
const DIEZ_B = BigInt(10);
const CIEN_B = BigInt(100);

const CIEN: Fraccion = { num: CIEN_B, den: UNO_B };
const UNO: Fraccion = { num: UNO_B, den: UNO_B };

function desdeDecimal(valor: Decimal): Fraccion {
  const texto = typeof valor === "number" ? String(valor) : valor.trim();
  if (!/^-?\d+(\.\d+)?$/.test(texto)) throw new Error(`Valor decimal inválido: ${texto}`);
  const [entero, fraccion = ""] = texto.replace("-", "").split(".");
  const num = BigInt(entero + fraccion);
  return { num: texto.startsWith("-") ? -num : num, den: DIEZ_B ** BigInt(fraccion.length) };
}

function multiplicar(a: Fraccion, b: Fraccion): Fraccion {
  return { num: a.num * b.num, den: a.den * b.den };
}

function sumarFracciones(a: Fraccion, b: Fraccion): Fraccion {
  return { num: a.num * b.den + b.num * a.den, den: a.den * b.den };
}

function restarFracciones(a: Fraccion, b: Fraccion): Fraccion {
  return sumarFracciones(a, { num: -b.num, den: b.den });
}

function dividir(a: Fraccion, b: Fraccion): Fraccion {
  if (b.num === CERO_B) throw new Error("División entre cero");
  const signo = b.num < CERO_B ? -UNO_B : UNO_B;
  return { num: a.num * b.den * signo, den: a.den * b.num * signo };
}

function redondear(valor: Fraccion, decimales: number): string {
  const escala = DIEZ_B ** BigInt(decimales);
  const negativo = valor.num < CERO_B;
  const absoluto = negativo ? -valor.num : valor.num;
  const redondeado = (DOS_B * absoluto * escala + valor.den) / (DOS_B * valor.den);
  const cifras = redondeado.toString().padStart(decimales + 1, "0");
  const entero = cifras.slice(0, cifras.length - decimales);
  const texto = decimales === 0 ? entero : `${entero}.${cifras.slice(cifras.length - decimales)}`;
  return negativo && redondeado !== CERO_B ? `-${texto}` : texto;
}

export function aDecimal(valor: Decimal, decimales: number): string {
  return redondear(desdeDecimal(valor), decimales);
}

export function sumar(valores: Decimal[], decimales: number): string {
  const total = valores.reduce<Fraccion>((acumulado, valor) => sumarFracciones(acumulado, desdeDecimal(valor)), {
    num: CERO_B,
    den: UNO_B,
  });
  return redondear(total, decimales);
}

export function comparar(a: Decimal, b: Decimal): -1 | 0 | 1 {
  const diferencia = restarFracciones(desdeDecimal(a), desdeDecimal(b)).num;
  if (diferencia === CERO_B) return 0;
  return diferencia < CERO_B ? -1 : 1;
}

// Los valores se normalizan a la escala de la columna antes de operar: así el cálculo usa lo que la base guarda.
function normalizado(valor: Decimal, decimales: number): Fraccion {
  return desdeDecimal(aDecimal(valor, decimales));
}

function exigirMargen(margenPct: Decimal): Fraccion {
  const margen = normalizado(margenPct, 2);
  if (margen.num < CERO_B || margen.num >= CIEN_B * margen.den) {
    throw new Error(`El margen debe estar entre 0 y 100 (sin incluir 100): ${margenPct}`);
  }
  return margen;
}

export type EntradaLinea = { cantidad: Decimal; costoUnitario: Decimal; mermaPct: Decimal };

// linea_costo.importe = round(cantidad * costo_unitario * (1 + merma_pct / 100), 2)
export function importeLinea({ cantidad, costoUnitario, mermaPct }: EntradaLinea): string {
  const factorMerma = sumarFracciones(UNO, dividir(normalizado(mermaPct, 2), CIEN));
  const costo = multiplicar(normalizado(cantidad, 3), normalizado(costoUnitario, 4));
  return redondear(multiplicar(costo, factorMerma), 2);
}

export type EntradaCatalogo = {
  unidadCobro: UnidadCobroCalculo;
  precioUnitario: Decimal;
  cantidad: Decimal;
  ancho?: Decimal | null;
  alto?: Decimal | null;
};

// item_cotizacion.importe de catálogo: UNIDAD = precio * cantidad. M2 = precio * ancho * alto * cantidad.
export function importeCatalogo({ unidadCobro, precioUnitario, cantidad, ancho, alto }: EntradaCatalogo): string {
  const base = multiplicar(normalizado(precioUnitario, 2), normalizado(cantidad, 3));
  if (unidadCobro === "UNIDAD") return redondear(base, 2);
  if (ancho == null || alto == null) throw new Error("El cobro por m2 exige ancho y alto");
  return redondear(multiplicar(multiplicar(base, normalizado(ancho, 3)), normalizado(alto, 3)), 2);
}

// Margen sobre el precio de venta (D-15): precio = costo / (1 - margen / 100).
export function importePersonalizado({ costoTotal, margenPct }: { costoTotal: Decimal; margenPct: Decimal }): string {
  const complemento = restarFracciones(UNO, dividir(exigirMargen(margenPct), CIEN));
  return redondear(dividir(normalizado(costoTotal, 2), complemento), 2);
}

export function precioUnitarioPersonalizado({ importe, cantidad }: { importe: Decimal; cantidad: Decimal }): string {
  return redondear(dividir(normalizado(importe, 2), normalizado(cantidad, 3)), 2);
}

export type TotalesCotizacion = { subtotal: string; descuento: string; impuesto: string; total: string };

// cotizacion_aritmetica: impuesto = round((subtotal - descuento) * tasa / 100, 2) y total = subtotal - descuento + impuesto.
export function totalesCotizacion(entrada: {
  importes: Decimal[];
  descuento: Decimal;
  tasaPct: Decimal;
}): TotalesCotizacion {
  const subtotal = sumar(entrada.importes, 2);
  const descuento = aDecimal(entrada.descuento, 2);
  if (comparar(descuento, 0) < 0 || comparar(descuento, subtotal) > 0) {
    throw new Error(`El descuento ${descuento} debe estar entre 0 y el subtotal ${subtotal}`);
  }
  const neto = restarFracciones(desdeDecimal(subtotal), desdeDecimal(descuento));
  const impuesto = redondear(dividir(multiplicar(neto, normalizado(entrada.tasaPct, 2)), CIEN), 2);
  return { subtotal, descuento, impuesto, total: sumar([redondear(neto, 2), impuesto], 2) };
}

// Margen resultante de los ítems personalizados: (precio - costo) / precio, en porcentaje. Nulo si no hay ninguno.
export function margenResultante(items: { costoTotal: Decimal; importe: Decimal }[]): string | null {
  if (items.length === 0) return null;
  const importe = desdeDecimal(sumar(items.map((i) => i.importe), 2));
  if (importe.num === CERO_B) return null;
  const costo = desdeDecimal(sumar(items.map((i) => i.costoTotal), 2));
  return redondear(multiplicar(dividir(restarFracciones(importe, costo), importe), CIEN), 2);
}

// consumo_estimado.cantidad desde la receta. La receta se expresa por unidad de cobro del producto.
export function cantidadReceta(entrada: {
  cantidadPorUnidad: Decimal;
  unidadCobro: UnidadCobroCalculo;
  cantidad: Decimal;
  ancho?: Decimal | null;
  alto?: Decimal | null;
}): string {
  const base = multiplicar(desdeDecimal(entrada.cantidadPorUnidad), normalizado(entrada.cantidad, 3));
  if (entrada.unidadCobro === "UNIDAD") return redondear(base, 3);
  if (entrada.ancho == null || entrada.alto == null) throw new Error("El cobro por m2 exige ancho y alto");
  return redondear(multiplicar(multiplicar(base, normalizado(entrada.ancho, 3)), normalizado(entrada.alto, 3)), 3);
}

// Material que se debe disponer en una línea de costo: la cantidad más la merma.
export function cantidadConMerma({ cantidad, mermaPct }: { cantidad: Decimal; mermaPct: Decimal }): string {
  const factor = sumarFracciones(UNO, dividir(normalizado(mermaPct, 2), CIEN));
  return redondear(multiplicar(normalizado(cantidad, 3), factor), 3);
}
