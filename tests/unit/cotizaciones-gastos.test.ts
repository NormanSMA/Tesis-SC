import { describe, expect, it } from "vitest";
import { gastosCalculados } from "@/modules/personalizadas/gastos-calculo";
import { gastosIniciales, esquemaGastos } from "@/modules/personalizadas/gastos-schema";
import { validarDescuentoGastos } from "@/modules/personalizadas/descuentos";
import { costearItemPersonalizado } from "@/core/costeo";

const base = { cantidad: "1", margenPct: "30", lineas: [{ tipo: "TERCERO" as const, costo: "1000" }] };
describe("cotizaciones: gastos y precio final sin circularidad", () => {
  it("calcula ida y vuelta, varios viajes, personas y horas sin repetir cantidades del producto", () => {
    const gastos = { ...gastosIniciales("NIO"), kmIda: "10", viajes: "2", personas: "3", horasPersona: "4", tarifaHora: "350", rentaValor: "1500" };
    const calculados = gastosCalculados({ ...base, cantidad: "20", gastos });
    expect(calculados).toEqual([
      { descripcion: "Renta asignada al trabajo", costo: "1500" },
      { descripcion: "Traslado: ida y vuelta por viajes", costo: "640.00" },
      { descripcion: "Mano de obra: personas por horas", costo: "4200.00" },
    ]);
  });
  it("reconcilia renta, imprevistos e impuestos sobre el precio de venta final", () => {
    const gastos = { ...gastosIniciales("NIO"), rentaModo: "PORCENTAJE" as const, rentaValor: "5", imprevistosPct: "10", impuestosPct: "3" };
    const calculados = gastosCalculados({ ...base, gastos });
    const resultado = costearItemPersonalizado({ ...base, lineas: [...base.lineas, ...calculados.map(c => ({ tipo: "TERCERO" as const, costo: c.costo }))] });
    expect(resultado.importe).toBe("1923.07");
    expect(calculados.map(c => c.costo)).toEqual(["96.15", "192.31", "57.69"]);
    expect(Number(resultado.importe) - Number(resultado.costoTotal)).toBeCloseTo(Number(resultado.importe) * .3, 2);
  });
  it("rechaza porcentajes sin solución, tarifas faltantes y viajes en cero", () => {
    expect(() => gastosCalculados({ ...base, margenPct: "90", gastos: { ...gastosIniciales("NIO"), imprevistosPct: "10" } })).toThrow("menos de 100");
    expect(esquemaGastos.safeParse({ ...gastosIniciales("USD"), kmIda: "1" }).success).toBe(false);
    expect(esquemaGastos.safeParse({ ...gastosIniciales("NIO"), kmIda: "1", viajes: "0" }).success).toBe(false);
  });
  it("permite descuentos con gastos fijos y protege la base final de los porcentajes", () => {
    expect(() => validarDescuentoGastos({ items: [{ gastosPersonalizados: gastosIniciales("NIO") }], descuento: "50" })).not.toThrow();
    expect(() => validarDescuentoGastos({ items: [{ gastosPersonalizados: { ...gastosIniciales("NIO"), imprevistosPct: "5" } }], descuento: "0", descuentoPct: "10" })).toThrow("descuento cero");
  });
});
