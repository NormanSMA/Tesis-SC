import { describe, expect, it } from "vitest";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { alertaMaterial } from "@/modules/inventario/reglas";

describe("alertas reutilizadas en panel", () => {
  it.each([
    [true, "0.000", "1.000", "Sin existencia"], [true, "1.000", "1.000", "Stock bajo"],
    [true, "0.999", "1.000", "Stock bajo"], [true, "1.001", "1.000", null],
    [true, "0.000", "0.000", null], [false, "0.000", "1.000", null],
    [true, "99999999999.999", "99999999999.998", null],
  ].map(([activo, existencia, stockMinimo, esperado]) => ({ activo, existencia, stockMinimo, esperado })))("alerta $existencia / $stockMinimo", ({ activo, existencia, stockMinimo, esperado }) => {
    expect(alertaMaterial({ activo: Boolean(activo), existencia: String(existencia), stockMinimo: String(stockMinimo) })).toBe(esperado);
  });
  it("cambia hoy a medianoche de Managua", () => {
    expect(hoyManagua(new Date("2034-05-02T05:59:59.999Z"))).toBe("2034-05-01");
    expect(hoyManagua(new Date("2034-05-02T06:00:00.000Z"))).toBe("2034-05-02");
  });
});
