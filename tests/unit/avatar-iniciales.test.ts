import { describe, expect, it } from "vitest";

import { iniciales, tonoDe } from "@/components/comunes/AvatarIniciales";

describe("AvatarIniciales", () => {
  it.each([
    ["Agencia Viajes Tropical", "AV"],
    ["Óptica Visión 20/20", "ÓV"],
    ["Hotel  Gran Centrómera", "HG"],
    ["Farmacia", "FA"],
    ["  ", ""],
  ])("%s produce %s", (nombre, esperado) => {
    expect(iniciales(nombre)).toBe(esperado);
  });

  it("el color es estable para el mismo nombre", () => {
    expect(tonoDe("Colegio San Ignacio")).toBe(tonoDe("Colegio San Ignacio"));
  });

  it("reparte colores distintos entre varios clientes", () => {
    const nombres = ["Agencia Viajes Tropical", "Carlos Mendoza Reyes", "Centro de Belleza Iris", "Colegio San Ignacio", "Constructora Horizonte", "Farmacia del Centro"];
    expect(new Set(nombres.map(tonoDe)).size).toBeGreaterThan(2);
  });
});
