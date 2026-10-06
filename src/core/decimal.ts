// Aritmética decimal exacta para dinero, cantidades y porcentajes.
// Cada valor es una fracción de enteros grandes: suma, producto y división no pierden precisión.
// Solo redondear() descarta cifras, igual que round(numeric, n) de PostgreSQL.

export type Racional = { readonly num: bigint; readonly den: bigint };

// El target ES2017 del proyecto no admite literales bigint (0n): se construyen con BigInt().
const CERO_B = BigInt(0);
const UNO_B = BigInt(1);
const DOS_B = BigInt(2);
const DIEZ_B = BigInt(10);

const PATRON_DECIMAL = /^-?\d+(\.\d+)?$/;

export function deEntero(valor: number): Racional {
  return { num: BigInt(valor), den: UNO_B };
}

export const CERO = deEntero(0);
export const UNO = deEntero(1);
export const CIEN = deEntero(100);

/** Lee una cadena como "1250.5" o "-3". Devuelve null si no es un decimal con punto. */
export function leerDecimal(texto: string): Racional | null {
  if (!PATRON_DECIMAL.test(texto)) return null;
  const negativo = texto.startsWith("-");
  const [entero, fraccion = ""] = (negativo ? texto.slice(1) : texto).split(".");
  const num = BigInt(entero + fraccion);
  return { num: negativo ? -num : num, den: DIEZ_B ** BigInt(fraccion.length) };
}

export function sumar(a: Racional, b: Racional): Racional {
  return { num: a.num * b.den + b.num * a.den, den: a.den * b.den };
}

export function restar(a: Racional, b: Racional): Racional {
  return sumar(a, { num: -b.num, den: b.den });
}

export function multiplicar(a: Racional, b: Racional): Racional {
  return { num: a.num * b.num, den: a.den * b.den };
}

export function dividir(a: Racional, b: Racional): Racional {
  if (b.num === CERO_B) throw new Error("División entre cero");
  const signo = b.num < CERO_B ? -UNO_B : UNO_B;
  return { num: a.num * b.den * signo, den: a.den * b.num * signo };
}

export function comparar(a: Racional, b: Racional): -1 | 0 | 1 {
  const diferencia = restar(a, b).num;
  if (diferencia === CERO_B) return 0;
  return diferencia < CERO_B ? -1 : 1;
}

/** Verdadero si el valor se escribe sin pérdida con esa cantidad de decimales. */
export function tieneEscala(valor: Racional, decimales: number): boolean {
  return (valor.num * DIEZ_B ** BigInt(decimales)) % valor.den === CERO_B;
}

/** Redondeo de round(numeric, n) en PostgreSQL: la mitad se aleja de cero. */
export function redondear(valor: Racional, decimales: number): Racional {
  const escala = DIEZ_B ** BigInt(decimales);
  const absoluto = valor.num < CERO_B ? -valor.num : valor.num;
  const redondeado = (DOS_B * absoluto * escala + valor.den) / (DOS_B * valor.den);
  return { num: valor.num < CERO_B ? -redondeado : redondeado, den: escala };
}

/** Redondea y escribe con decimales fijos, como PostgreSQL muestra un numeric(p, s). */
export function formatear(valor: Racional, decimales: number): string {
  const { num } = redondear(valor, decimales);
  const cifras = (num < CERO_B ? -num : num).toString().padStart(decimales + 1, "0");
  const entero = cifras.slice(0, cifras.length - decimales);
  const texto = decimales === 0 ? entero : `${entero}.${cifras.slice(cifras.length - decimales)}`;
  return num < CERO_B ? `-${texto}` : texto;
}
