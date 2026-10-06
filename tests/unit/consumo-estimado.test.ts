import { describe, expect, it } from "vitest";
import { calcularConsumoEstimado, normalizarUnidad, type ItemEstimable } from "@/core/consumo-estimado";

const VINIL = "00000000-0000-4000-8000-000000000001";
const TINTA = "00000000-0000-4000-8000-000000000002";
const unidadesMaterial = { [VINIL]: "M2", [TINTA]: "LITRO" };

function catalogo(extra: Partial<Extract<ItemEstimable, { tipo: "CATALOGO" }>> = {}): ItemEstimable {
  return { secuencia: 1, tipo: "CATALOGO", unidadCobro: "UNIDAD", cantidad: "2.000", ancho: null, alto: null,
    receta: [{ materialId: VINIL, cantidad: "1.500" }], ...extra };
}

describe("calcularConsumoEstimado", () => {
  it("multiplica la receta por la cantidad en cobro por unidad", () => {
    const { consumos } = calcularConsumoEstimado({ items: [catalogo()], unidadesMaterial });
    expect(consumos).toEqual([{ materialId: VINIL, cantidad: "3.000", origen: "RECETA" }]);
  });

  it("multiplica además por ancho y alto en cobro por m2", () => {
    const item = catalogo({ unidadCobro: "M2", cantidad: "3.000", ancho: "2.000", alto: "1.500" });
    const { consumos } = calcularConsumoEstimado({ items: [item], unidadesMaterial });
    expect(consumos[0].cantidad).toBe("13.500");
  });

  it("rechaza cobro por m2 sin medidas", () => {
    expect(() => calcularConsumoEstimado({ items: [catalogo({ unidadCobro: "M2" })], unidadesMaterial })).toThrow();
  });

  it("suma la merma de las líneas de material de un ítem personalizado", () => {
    const item: ItemEstimable = { secuencia: 1, tipo: "PERSONALIZADO", lineas: [
      { secuencia: 1, materialId: TINTA, unidad: "litro", cantidad: "10.000", mermaPct: "5.00" },
      { secuencia: 2, materialId: null, unidad: "hora", cantidad: "3.000", mermaPct: "0.00" },
    ] };
    const { consumos, advertencias } = calcularConsumoEstimado({ items: [item], unidadesMaterial });
    expect(consumos).toEqual([{ materialId: TINTA, cantidad: "10.500", origen: "COTIZACION" }]);
    expect(advertencias).toEqual([]);
  });

  it("suma por material y prefiere el origen RECETA", () => {
    const personalizado: ItemEstimable = { secuencia: 2, tipo: "PERSONALIZADO", lineas: [
      { secuencia: 1, materialId: VINIL, unidad: "m2", cantidad: "2.000", mermaPct: "0.00" },
    ] };
    const { consumos } = calcularConsumoEstimado({ items: [catalogo(), personalizado], unidadesMaterial });
    expect(consumos).toEqual([{ materialId: VINIL, cantidad: "5.000", origen: "RECETA" }]);
  });

  it("advierte y no suma una línea con unidad distinta de la del material", () => {
    const item: ItemEstimable = { secuencia: 3, tipo: "PERSONALIZADO", lineas: [
      { secuencia: 2, materialId: VINIL, unidad: "rollo", cantidad: "2.000", mermaPct: "0.00" },
    ] };
    const { consumos, advertencias } = calcularConsumoEstimado({ items: [item], unidadesMaterial });
    expect(consumos).toEqual([]);
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toMatchObject({ itemSecuencia: 3, lineaSecuencia: 2 });
  });

  it("omite materiales con cantidad total cero", () => {
    const item = catalogo({ cantidad: "0.000" });
    expect(calcularConsumoEstimado({ items: [item], unidadesMaterial }).consumos).toEqual([]);
  });

  it("ordena los consumos por material para un resultado estable", () => {
    const item = catalogo({ receta: [{ materialId: TINTA, cantidad: "1.000" }, { materialId: VINIL, cantidad: "1.000" }] });
    const { consumos } = calcularConsumoEstimado({ items: [item], unidadesMaterial });
    expect(consumos.map((consumo) => consumo.materialId)).toEqual([VINIL, TINTA]);
  });
});

describe("normalizarUnidad", () => {
  it("ignora mayúsculas, superíndice y plural", () => {
    expect(normalizarUnidad("M²")).toBe("m2");
    expect(normalizarUnidad("Litros")).toBe("litro");
    expect(normalizarUnidad("M2")).toBe("m2");
  });
});
