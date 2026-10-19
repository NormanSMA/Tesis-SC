import { describe, expect, it } from "vitest";

import { esMargenBajo, margenPct } from "@/modules/catalogo/componentes/margen";

describe("margen del producto", () => {
  it("calcula el margen sobre el precio", () => {
    expect(margenPct("100.00", "75.0000")).toBe(25);
  });
  it("devuelve nulo sin costo o con precio no positivo", () => {
    expect(margenPct("100", undefined)).toBeNull();
    expect(margenPct("100", null)).toBeNull();
    expect(margenPct("0", "10")).toBeNull();
  });
  it("marca margen bajo bajo el umbral y con margen negativo", () => {
    expect(esMargenBajo(margenPct("100", "90"))).toBe(true);
    expect(esMargenBajo(margenPct("100", "120"))).toBe(true);
    expect(esMargenBajo(margenPct("100", "50"))).toBe(false);
    expect(esMargenBajo(null)).toBe(false);
  });
});
