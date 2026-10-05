import { describe, expect, it } from "vitest";

import { formatearCantidad, formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";

describe("formatearMoneda", () => {
  it("agrupa miles y fija dos decimales", () => {
    expect(formatearMoneda("1234.5")).toBe("C$ 1,234.50");
    expect(formatearMoneda("0")).toBe("C$ 0.00");
    expect(formatearMoneda("1234567.891")).toBe("C$ 1,234,567.89");
  });

  it("redondea sin pasar por coma flotante", () => {
    expect(formatearMoneda("0.005")).toBe("C$ 0.01");
    expect(formatearMoneda("2.675")).toBe("C$ 2.68");
    expect(formatearMoneda("999.999")).toBe("C$ 1,000.00");
  });

  it("conserva el signo negativo y evita el cero negativo", () => {
    expect(formatearMoneda("-45.1")).toBe("-C$ 45.10");
    expect(formatearMoneda("-0.001")).toBe("C$ 0.00");
  });

  it("devuelve vacío con valores ausentes o inválidos", () => {
    expect(formatearMoneda(null)).toBe("");
    expect(formatearMoneda("")).toBe("");
    expect(formatearMoneda("abc")).toBe("");
  });

  it("acepta números", () => {
    expect(formatearMoneda(1500)).toBe("C$ 1,500.00");
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
