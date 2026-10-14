import { describe, expect, it } from "vitest";

import { formatearCantidad, formatearCantidadConUnidad, formatearCantidadPorUnidad, formatearFecha, formatearFechaHora, formatearMoneda, formatearMonedaEntera, formatearPorcentaje, nombreUnidad } from "@/lib/formato";

describe("formatearMoneda", () => {
  it("selecciona el símbolo y conserva el espacio duro", () => {
    expect(formatearMoneda("1234.5", "NIO")).toBe("C$\u00A01,234.50");
    expect(formatearMoneda("1234.5", "USD")).toBe("US$\u00A01,234.50");
    expect(formatearMoneda("-2.675", "USD")).toBe("-US$\u00A02.68");
    expect(formatearMoneda("-0.001", "USD")).toBe("US$\u00A00.00");
    expect(formatearMoneda(null, "USD")).toBe("");
  });

  it("agrupa miles y fija dos decimales", () => {
    expect(formatearMoneda("1234.5")).toBe("C$\u00A01,234.50");
    expect(formatearMoneda("0")).toBe("C$\u00A00.00");
    expect(formatearMoneda("1234567.891")).toBe("C$\u00A01,234,567.89");
  });

  it("redondea sin pasar por coma flotante", () => {
    expect(formatearMoneda("0.005")).toBe("C$\u00A00.01");
    expect(formatearMoneda("2.675")).toBe("C$\u00A02.68");
    expect(formatearMoneda("999.999")).toBe("C$\u00A01,000.00");
  });

  it("conserva el signo negativo y evita el cero negativo", () => {
    expect(formatearMoneda("-45.1")).toBe("-C$\u00A045.10");
    expect(formatearMoneda("-0.001")).toBe("C$\u00A00.00");
  });

  it("devuelve vacío con valores ausentes o inválidos", () => {
    expect(formatearMoneda(null)).toBe("");
    expect(formatearMoneda("")).toBe("");
    expect(formatearMoneda("abc")).toBe("");
  });

  it("acepta números", () => {
    expect(formatearMoneda(1500)).toBe("C$\u00A01,500.00");
  });
});

describe("formatearCantidad", () => {
  it("usa los decimales pedidos", () => {
    expect(formatearCantidad("14.5", 3)).toBe("14.500");
    expect(formatearCantidad("1200", 0)).toBe("1,200");
  });
});

describe("formatearFecha", () => {
  it("formatea fechas de calendario sin corrimiento de zona horaria", () => {
    expect(formatearFecha("2026-10-05")).toBe("05 oct 2026");
    expect(formatearFecha("2026-01-01")).toBe("01 ene 2026");
    expect(formatearFecha("2026-12-31")).toBe("31 dic 2026");
  });

  it("convierte instantes a la hora de Managua", () => {
    expect(formatearFecha("2026-10-06T03:00:00Z")).toBe("05 oct 2026");
    expect(formatearFechaHora("2026-10-05T20:42:00Z")).toBe("05 oct 2026, 14:42");
  });

  it("devuelve vacío con valores inválidos", () => {
    expect(formatearFecha(null)).toBe("");
    expect(formatearFecha("no es fecha")).toBe("");
    expect(formatearFechaHora("")).toBe("");
  });
});

describe("formatos de reporte y panel", () => {
  it("selecciona el símbolo para dinero sin decimales", () => {
    expect(formatearMonedaEntera("1234.5", "NIO")).toBe("C$\u00A01,235");
    expect(formatearMonedaEntera("1234.5", "USD")).toBe("US$\u00A01,235");
    expect(formatearMonedaEntera("-1234.5", "USD")).toBe("-US$\u00A01,235");
    expect(formatearMonedaEntera(null, "USD")).toBe("");
  });

  it("muestra dinero sin decimales con redondeo exacto", () => {
    expect(formatearMonedaEntera("1174042.49")).toBe("C$\u00A01,174,042");
    expect(formatearMonedaEntera("1174042.50")).toBe("C$\u00A01,174,043");
    expect(formatearMonedaEntera(null)).toBe("");
  });

  it("agrega el símbolo de porcentaje", () => {
    expect(formatearPorcentaje("88.24")).toBe("88.2 %");
    expect(formatearPorcentaje("100.00", 0)).toBe("100 %");
  });

  it("quita el decimal sobrante del porcentaje", () => {
    expect(formatearPorcentaje("80.0")).toBe("80 %");
    expect(formatearPorcentaje("80.04")).toBe("80 %");
    expect(formatearPorcentaje("12.50")).toBe("12.5 %");
  });

  it("usa 24 horas sin indicador a. m. ni p. m.", () => {
    expect(formatearFechaHora("2026-10-05T16:49:00Z")).toBe("05 oct 2026, 10:49");
    expect(formatearFechaHora("2026-10-05T06:05:00Z")).toBe("05 oct 2026, 00:05");
  });

  it("recorta ceros de unidades continuas y agrupa miles", () => {
    expect(formatearCantidadPorUnidad("1234.500", "Kilogramo")).toBe("1,234.5");
    expect(formatearCantidadPorUnidad("0.125", "LITRO")).toBe("0.125");
    expect(formatearCantidadPorUnidad("1200.000", "ROLLO")).toBe("1,200");
    expect(formatearCantidadPorUnidad("3.700", "ROLLO")).toBe("3.7");
    expect(formatearCantidadPorUnidad("0.500", "PLIEGO")).toBe("0.5");
  });

  it("nombra la unidad en minúscula", () => {
    expect(nombreUnidad("M2")).toBe("m²");
    expect(nombreUnidad("PLIEGO")).toBe("pliego");
    expect(nombreUnidad("KILOGRAMO")).toBe("kilogramo");
    expect(formatearCantidadConUnidad("2.500", "M2")).toBe("2.5 m²");
  });

  it("muestra enteros solo en unidades discretas", () => {
    expect(formatearCantidadPorUnidad("64.000", "UNIDAD")).toBe("64");
    expect(formatearCantidadPorUnidad("1200.000", "Pliego")).toBe("1,200");
    expect(formatearCantidadPorUnidad("64.000", "Metro")).toBe("64");
  });
});
