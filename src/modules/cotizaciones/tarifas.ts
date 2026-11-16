import { z } from "zod";

export const TARIFAS = ["OCASIONAL", "INTERMEDIA", "PREFERENCIAL"] as const;
export type Tarifa = (typeof TARIFAS)[number];
export type PorcentajesTarifa = Record<Tarifa, string>;

export const NOMBRES_TARIFA: Record<Tarifa, string> = {
  OCASIONAL: "Cliente ocasional", INTERMEDIA: "Tarifa intermedia", PREFERENCIAL: "Cliente preferencial",
};

export const esquemaPorcentajeTarifa = z.string()
  .regex(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, "Ingrese un porcentaje de 0 a 100 con hasta 2 decimales.");

export const TARIFAS_INICIALES: PorcentajesTarifa = { OCASIONAL: "0", INTERMEDIA: "5", PREFERENCIAL: "10" };
