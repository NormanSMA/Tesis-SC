import { describe, expect, it } from "vitest";

import {
  aDecimal,
  cantidadConMerma,
  cantidadReceta,
  comparar,
  importeCatalogo,
  importeLinea,
  importePersonalizado,
  margenResultante,
  precioUnitarioPersonalizado,
  sumar,
  totalesCotizacion,
} from "../../prisma/seed/calculos";

describe("redondeo decimal", () => {
  it("redondea la mitad hacia arriba en valor absoluto como round de PostgreSQL", () => {
    expect(aDecimal("0.005", 2)).toBe("0.01");
    expect(aDecimal("1.004", 2)).toBe("1.00");
    expect(aDecimal("-0.005", 2)).toBe("-0.01");
    expect(aDecimal("2.5", 0)).toBe("3");
  });

  it("completa los decimales con ceros", () => {
    expect(aDecimal(15, 2)).toBe("15.00");
    expect(aDecimal("0.4", 4)).toBe("0.4000");
  });

  it("rechaza valores que no son decimales", () => {
    expect(() => aDecimal("abc", 2)).toThrow("Valor decimal inválido");
  });

  it("suma y compara sin error de punto flotante", () => {
    expect(sumar(["0.1", "0.2"], 2)).toBe("0.30");
    expect(comparar("0.30", 0.3)).toBe(0);
    expect(comparar("10", "9.99")).toBe(1);
    expect(comparar("1", "2")).toBe(-1);
  });
});

describe("importe de ítem de catálogo", () => {
  it("cobra por unidad: precio por cantidad", () => {
    expect(importeCatalogo({ unidadCobro: "UNIDAD", precioUnitario: "1320", cantidad: 3 })).toBe("3960.00");
  });

  it("cobra por m2: precio por ancho, alto y cantidad", () => {
    const entrada = { unidadCobro: "M2" as const, precioUnitario: 1650, cantidad: 10, ancho: 1.2, alto: 0.8 };
    expect(importeCatalogo(entrada)).toBe("15840.00");
  });

  it("redondea el importe por m2 a dos decimales", () => {
    const entrada = { unidadCobro: "M2" as const, precioUnitario: 1025, cantidad: 1, ancho: 0.333, alto: 0.777 };
    expect(importeCatalogo(entrada)).toBe("265.21");
  });

  it("redondea la mitad hacia arriba", () => {
    expect(importeCatalogo({ unidadCobro: "UNIDAD", precioUnitario: "0.05", cantidad: "0.1" })).toBe("0.01");
  });

  it("exige medidas cuando se cobra por m2", () => {
    expect(() => importeCatalogo({ unidadCobro: "M2", precioUnitario: 1650, cantidad: 1 })).toThrow("ancho y alto");
  });
});

describe("línea de costo", () => {
  it("material con merma: cantidad por costo por (1 + merma)", () => {
    expect(importeLinea({ cantidad: 5, costoUnitario: 2850, mermaPct: 8 })).toBe("15390.00");
    expect(importeLinea({ cantidad: 3, costoUnitario: 22, mermaPct: 5 })).toBe("69.30");
    expect(importeLinea({ cantidad: 15, costoUnitario: 70, mermaPct: 3 })).toBe("1081.50");
  });

  it("mano de obra y terceros no llevan merma", () => {
    expect(importeLinea({ cantidad: 4, costoUnitario: 150, mermaPct: 0 })).toBe("600.00");
    expect(importeLinea({ cantidad: 1, costoUnitario: 3500, mermaPct: 0 })).toBe("3500.00");
  });

  it("usa el costo unitario con cuatro decimales", () => {
    expect(importeLinea({ cantidad: 3, costoUnitario: "33.3333", mermaPct: 0 })).toBe("100.00");
    expect(importeLinea({ cantidad: 7, costoUnitario: "0.3333", mermaPct: 0 })).toBe("2.33");
  });
});

describe("ítem personalizado con margen sobre el precio", () => {
  it("precio = costo / (1 - margen / 100)", () => {
    expect(importePersonalizado({ costoTotal: "17980.80", margenPct: 35 })).toBe("27662.77");
    expect(importePersonalizado({ costoTotal: "28189.00", margenPct: 40 })).toBe("46981.67");
    expect(importePersonalizado({ costoTotal: 1000, margenPct: 0 })).toBe("1000.00");
  });

  it("rechaza un margen de 100 o más", () => {
    expect(() => importePersonalizado({ costoTotal: 1000, margenPct: 100 })).toThrow("entre 0 y 100");
    expect(() => importePersonalizado({ costoTotal: 1000, margenPct: -1 })).toThrow("entre 0 y 100");
  });

  it("deriva el precio unitario del importe y la cantidad", () => {
    expect(precioUnitarioPersonalizado({ importe: "27662.77", cantidad: 1 })).toBe("27662.77");
    expect(precioUnitarioPersonalizado({ importe: "100.00", cantidad: 3 })).toBe("33.33");
  });

  it("calcula el margen resultante de varios ítems", () => {
    const items = [
      { costoTotal: "100.00", importe: "125.00" },
      { costoTotal: "200.00", importe: "250.00" },
    ];
    expect(margenResultante(items)).toBe("20.00");
    expect(margenResultante([{ costoTotal: "17980.80", importe: "27662.77" }])).toBe("35.00");
    expect(margenResultante([])).toBeNull();
  });
});

describe("totales de cotización", () => {
  it("aplica el IVA sobre el subtotal", () => {
    expect(totalesCotizacion({ importes: ["27662.77"], descuento: 0, tasaPct: "15.00" })).toEqual({
      subtotal: "27662.77",
      descuento: "0.00",
      impuesto: "4149.42",
      total: "31812.19",
    });
  });

  it("suma varios ítems", () => {
    const totales = totalesCotizacion({ importes: ["8250.00", "46981.67"], descuento: 0, tasaPct: 15 });
    expect(totales).toEqual({ subtotal: "55231.67", descuento: "0.00", impuesto: "8284.75", total: "63516.42" });
  });

  it("resta el descuento global antes del IVA", () => {
    expect(totalesCotizacion({ importes: ["1250.00"], descuento: 50, tasaPct: 15 })).toEqual({
      subtotal: "1250.00",
      descuento: "50.00",
      impuesto: "180.00",
      total: "1380.00",
    });
    expect(totalesCotizacion({ importes: ["10000.00"], descuento: "500", tasaPct: 15 }).total).toBe("10925.00");
  });

  it("redondea el IVA a dos decimales", () => {
    const totales = totalesCotizacion({ importes: ["333.33"], descuento: 0, tasaPct: 15 });
    expect(totales.impuesto).toBe("50.00");
    expect(totales.total).toBe("383.33");
  });

  it("rechaza un descuento mayor al subtotal", () => {
    expect(() => totalesCotizacion({ importes: ["100.00"], descuento: 150, tasaPct: 15 })).toThrow("descuento");
  });

  it("cumple la identidad total = subtotal - descuento + impuesto", () => {
    const { subtotal, descuento, impuesto, total } = totalesCotizacion({
      importes: ["4600.00", "1320.55", "99.99"],
      descuento: "120.10",
      tasaPct: "15.00",
    });
    expect(sumar([subtotal, `-${descuento}`, impuesto], 2)).toBe(total);
  });
});

describe("consumo estimado", () => {
  it("receta por unidad de cobro UNIDAD", () => {
    expect(cantidadReceta({ cantidadPorUnidad: 0.2, unidadCobro: "UNIDAD", cantidad: 2 })).toBe("0.400");
  });

  it("receta por m2 multiplica por la superficie", () => {
    const entrada = { cantidadPorUnidad: 0.5, unidadCobro: "M2" as const, cantidad: 5, ancho: 1, alto: 1 };
    expect(cantidadReceta(entrada)).toBe("2.500");
    expect(cantidadReceta({ ...entrada, ancho: 1.2, alto: 0.5 })).toBe("1.500");
  });

  it("suma la merma a la cantidad de una línea de material", () => {
    expect(cantidadConMerma({ cantidad: 4, mermaPct: 10 })).toBe("4.400");
    expect(cantidadConMerma({ cantidad: 1, mermaPct: 0 })).toBe("1.000");
  });
});
