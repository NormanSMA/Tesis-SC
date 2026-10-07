import { describe, expect, it } from "vitest";
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
