import { describe, expect, it } from "vitest";
import { celdaVisible, etiquetaVisible, totalVisible } from "@/modules/reportes/columnas";
import { leerFiltrosPagina } from "@/modules/reportes/paginas";
import { tasaAprobacion } from "@/modules/reportes/reglas";
import { esquemaConsulta, esquemaPeriodo } from "@/modules/reportes/schema";

describe("tasa de aprobación", () => {
  it.each([[0, 0, "0.00"], [2, 1, "66.67"], [1, 2, "33.33"], [3, 0, "100.00"], [0, 3, "0.00"]])(
    "%i aprobadas y %i rechazadas produce %s", (aprobadas, rechazadas, esperado) => {
      expect(tasaAprobacion(Number(aprobadas), Number(rechazadas))).toBe(esperado);
    });
});
describe("periodos de Managua", () => {
  it.each([{}, { desde: "2034-05-01" }, { hasta: "2034-05-01" }, { desde: "2034-05-01", hasta: "2034-05-01" },
    { desde: "2024-02-29", hasta: "2029-02-28" }, { desde: "2025-05-01", hasta: "2030-05-01" },
    { desde: "9998-01-01", hasta: "9999-01-01" }])("acepta %j", (periodo) => {
    expect(esquemaPeriodo.safeParse(periodo).success).toBe(true);
  });
  it.each([{ desde: "2026-02-30" }, { hasta: "2025-02-29" }, { desde: "01-05-2034" },
    { desde: "2034-05-02", hasta: "2034-05-01" }, { desde: "2025-05-01", hasta: "2030-05-02" },
    { desde: "2024-02-29", hasta: "2029-03-01" }, { desde: "0000-01-01" },
    { desde: "2034-99-99", hasta: "2035-01-01" }])("rechaza %j", (periodo) => {
    expect(esquemaPeriodo.safeParse(periodo).success).toBe(false);
  });
  it("rechaza filtros y formato inválidos", () => {
    for (const entrada of [{ area: "no" }, { formato: "pdf" }, { soloAlertas: "si" }, { texto: "a".repeat(201) }]) {
      expect(esquemaConsulta.safeParse(entrada).success).toBe(false);
    }
  });
});
describe("formato visible de reportes", () => {
  const columna = (campo: string) => ({ campo, encabezado: campo, tipo: "decimal" as const });
  it("da formato a importes, cantidades y porcentajes", () => {
    expect(celdaVisible(columna("importe"), { importe: "262932.59" })).toBe("C$ 262,932.59");
    expect(celdaVisible(columna("existencia"), { existencia: "64.000", unidad: "Unidad" })).toBe("64");
    expect(celdaVisible(columna("existencia"), { existencia: "64.000", unidad: "Metro" })).toBe("64.000");
    expect(celdaVisible(columna("alerta"), { alerta: null })).toBe("Sin dato");
    expect(totalVisible("tasaAprobacion", "88.24")).toBe("88.2 %");
    expect(totalVisible("importe", "1000")).toBe("C$ 1,000.00");
    expect(etiquetaVisible("Importe (C$)")).toBe("Importe");
    expect(etiquetaVisible("Tasa de aprobación (%)")).toBe("Tasa de aprobación");
  });
  it("propone el periodo desde enero hasta hoy solo en reportes con periodo", () => {
    expect(leerFiltrosPagina({}, "2026-10-11").consulta).toMatchObject({ desde: "2026-01-01", hasta: "2026-10-11" });
    expect(leerFiltrosPagina({ nombre: "existencias" }, "2026-10-11").consulta.desde).toBeUndefined();
    expect(leerFiltrosPagina({ desde: "", hasta: "" }, "2026-10-11").consulta.desde).toBeUndefined();
  });
});
