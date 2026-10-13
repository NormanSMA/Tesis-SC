import { esMoneda, type Moneda } from "@/core/moneda";

export function nombreMoneda(codigo: string): string {
  if (codigo === "NIO") return "Córdobas (NIO)";
  if (codigo === "USD") return "Dólares (USD)";
  return codigo;
}

export function monedaDe(codigo: string | undefined): Moneda {
  return esMoneda(codigo) ? codigo : "NIO";
}

export function simboloMoneda(moneda: Moneda): string {
  return moneda === "USD" ? "US$" : "C$";
}
