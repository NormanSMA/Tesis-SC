import { AppError } from "@/lib/errores";
import type { GastosPersonalizados } from "./gastos-schema";

export const LIMITE_DESCUENTO_GASTOS = "Las trabajos con porcentajes sobre venta requieren descuento cero. Ajuste primero el margen para conservar la base final de los gastos.";
export function tienePorcentajes(g?: GastosPersonalizados | null): boolean {
  return Boolean(g && (Number(g.imprevistosPct) > 0 || Number(g.impuestosPct) > 0 || (g.rentaModo === "PORCENTAJE" && Number(g.rentaValor) > 0)));
}
export function validarDescuentoGastos(entrada: { items: object[]; descuento: string; descuentoPct?: string | null }) {
  const activos = entrada.items.some(i => "gastosPersonalizados" in i && tienePorcentajes(i.gastosPersonalizados as GastosPersonalizados | null));
  if (activos && Number(entrada.descuentoPct ?? entrada.descuento) > 0) {
    throw new AppError({ status: 422, codigo: "VALIDACION", mensaje: LIMITE_DESCUENTO_GASTOS, campos: { descuento: LIMITE_DESCUENTO_GASTOS } });
  }
}
