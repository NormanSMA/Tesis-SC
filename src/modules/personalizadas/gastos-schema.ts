import { z } from "zod";
const numero = z.string().regex(/^\d{1,8}(\.\d{1,3})?$/, "Ingrese un número positivo con hasta tres decimales.");
const monto = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Ingrese un monto con hasta dos decimales.");
const porcentaje = z.string().regex(/^\d{1,2}(\.\d{1,2})?$/, "Ingrese un porcentaje menor que 100.");
export const esquemaGastos = z.object({ rentaModo: z.enum(["MONTO", "PORCENTAJE"]), rentaValor: monto,
  kmIda: numero, viajes: numero, tarifaKm: monto, personas: numero, horasPersona: numero, tarifaHora: monto,
  personasViaticos: numero, diasViaticos: numero, tarifaViatico: monto,
  personasHospedaje: numero, noches: numero, tarifaHospedaje: monto,
  imprevistosPct: porcentaje, impuestosPct: porcentaje }).superRefine((g, ctx) => {
    if (g.rentaModo === "PORCENTAJE" && Number(g.rentaValor) >= 100) ctx.addIssue({ code: "custom", path: ["rentaValor"], message: "La renta porcentual debe ser menor que 100." });
    for (const [cantidad,personas] of [["kmIda","viajes"],["horasPersona","personas"],["diasViaticos","personasViaticos"],["noches","personasHospedaje"]] as const) {
      if (Number(g[cantidad]) > 0 && Number(g[personas]) <= 0) ctx.addIssue({ code: "custom", path: [personas], message: "Indique una cantidad de personas o viajes mayor que cero." });
    }
    for (const [cantidad, tarifa] of [["kmIda","tarifaKm"],["horasPersona","tarifaHora"],["diasViaticos","tarifaViatico"],["noches","tarifaHospedaje"]] as const) {
      if (Number(g[cantidad]) > 0 && Number(g[tarifa]) <= 0) ctx.addIssue({ code: "custom", path: [tarifa], message: "Complete la tarifa para calcular este gasto." });
    }
  });
export const esquemaTarifasProducto = z.object({ moneda: z.enum(["NIO", "USD"]), km: monto.optional(), hora: monto, viatico: monto, hospedaje: monto, renta: monto });
export type TarifasProducto = z.infer<typeof esquemaTarifasProducto>;
export type GastosPersonalizados = z.infer<typeof esquemaGastos>;
export function tieneGastosFijos(g?: GastosPersonalizados | null): boolean {
  if (!g) return false;
  return (g.rentaModo === "MONTO" && Number(g.rentaValor) > 0) ||
    [[g.kmIda,g.viajes,g.tarifaKm],[g.horasPersona,g.personas,g.tarifaHora],
      [g.diasViaticos,g.personasViaticos,g.tarifaViatico],[g.noches,g.personasHospedaje,g.tarifaHospedaje]].some(v => v.every(n => Number(n) > 0));
}
export function gastosIniciales(moneda: string): GastosPersonalizados {
  return { rentaModo: "MONTO", rentaValor: "0", kmIda: "0", viajes: "1", tarifaKm: moneda === "NIO" ? "16" : "0",
    personas: "1", horasPersona: "0", tarifaHora: "0", personasViaticos: "1", diasViaticos: "0", tarifaViatico: "0",
    personasHospedaje: "1", noches: "0", tarifaHospedaje: "0", imprevistosPct: "0", impuestosPct: "0" };
}
