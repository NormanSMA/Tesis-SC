import { CERO, UNO, comparar, dividir, formatear, leerDecimal, multiplicar } from "@/core/decimal";

export const MONEDAS = ["NIO", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

export function esMoneda(valor: unknown): valor is Moneda {
  return MONEDAS.some((moneda) => moneda === valor);
}

function leerConversion(monto: string, tipoCambio: string) {
  const montoDecimal = leerDecimal(monto);
  const cambioDecimal = leerDecimal(tipoCambio);
  if (montoDecimal === null || cambioDecimal === null) {
    throw new Error("Ingrese montos y tipos de cambio como cadenas decimales.");
  }
  if (comparar(cambioDecimal, CERO) <= 0) {
    throw new Error("El tipo de cambio debe ser mayor que cero.");
  }
  return { montoDecimal, cambioDecimal };
}

export function convertirDesdeCordobas(montoNio: string, tipoCambio: string, decimales: 2 | 4): string {
  const { montoDecimal, cambioDecimal } = leerConversion(montoNio, tipoCambio);
  if (comparar(cambioDecimal, UNO) === 0) return montoNio;
  return formatear(dividir(montoDecimal, cambioDecimal), decimales);
}

export function aCordobas(monto: string, tipoCambio: string): string {
  const { montoDecimal, cambioDecimal } = leerConversion(monto, tipoCambio);
  return formatear(multiplicar(montoDecimal, cambioDecimal), 2);
}
