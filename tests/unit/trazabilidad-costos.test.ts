import { expect, it } from "vitest";
import { calcularCostos } from "@/modules/trazabilidad/costos";

it("calcula productos exactos y devoluciones sin redondear movimientos", () => {
  expect(calcularCostos([
    { materialId: "a", cantidad: "-0.001", costoUnitario: "0.0001" },
    { materialId: "a", cantidad: "-3.333", costoUnitario: "12.3456" },
    { materialId: "a", cantidad: "1.111", costoUnitario: "14.7654" },
    { materialId: "b", cantidad: "-2.001", costoUnitario: "7.1234" },
  ])).toEqual({ porMaterial: { a: "24.7435255", b: "14.2539234" }, total: "38.9974489" });
});
it("devuelve cero para órdenes sin movimientos", () => {
  expect(calcularCostos([])).toEqual({ porMaterial: {}, total: "0.0000000" });
});
it("rechaza valores inválidos del libro", () => {
  expect(() => calcularCostos([{ materialId: "a", cantidad: "NaN", costoUnitario: "1" }])).toThrow("decimal inválido");
});
