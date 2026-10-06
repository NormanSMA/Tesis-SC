import { describe, expect, it } from "vitest";
import { alertaMaterial, cantidadAjuste, limitesFecha, pendienteEstimado } from "@/modules/inventario/reglas";
import { esquemaAjuste, esquemaConsultaMateriales, esquemaConsultaMovimientos, esquemaCrearMaterial,
  esquemaEditarMaterial, esquemaEntrada, esquemaVersion } from "@/modules/inventario/schema";

const material = { codigo: "VIN-1", nombre: "Vinilo", unidad: "METRO", stockMinimo: "1.000", costoPromedio: "5.1234" };
const movimiento = { materialId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", cantidad: "1.001" };
describe("inventario: esquemas y reglas de materiales", () => {
  it("normaliza nombre, descripción y referencia", () => {
    expect(esquemaCrearMaterial.parse({ ...material, nombre: " Vinilo ", descripcion: " " })).toMatchObject({ nombre: "Vinilo", descripcion: null });
    expect(esquemaEntrada.parse({ ...movimiento, costoUnitario: "0", referencia: " " }).referencia).toBeNull();
  });
  it("rechaza existencia inicial, unidad editable y código editable", () => {
    expect(esquemaCrearMaterial.safeParse({ ...material, existencia: "1" }).success).toBe(false);
    for (const campo of ["unidad", "codigo", "activo", "existencia"]) {
      expect(esquemaEditarMaterial.safeParse({ version: "2026-10-06T12:00:00.000Z", [campo]: "UNIDAD" }).success).toBe(false);
    }
  });
  it.each(["0", "-1", "1.0001", "100000000000", "1e3", 1])("rechaza cantidad de entrada %s", (cantidad) => {
    expect(esquemaEntrada.safeParse({ ...movimiento, cantidad, costoUnitario: "1" }).success).toBe(false);
  });
  it.each(["-1", "1.12345", "10000000000", 1])("rechaza costo %s", (costoUnitario) => {
    expect(esquemaEntrada.safeParse({ ...movimiento, costoUnitario }).success).toBe(false);
  });
  it("admite límites decimales y costo cero", () => {
    expect(esquemaEntrada.safeParse({ ...movimiento, cantidad: "99999999999.999", costoUnitario: "9999999999.9999" }).success).toBe(true);
    expect(esquemaEntrada.safeParse({ ...movimiento, costoUnitario: "0" }).success).toBe(true);
  });
  it("exige motivo y dirección del ajuste sin costo", () => {
    const valido = { ...movimiento, direccion: "DISMINUIR", motivo: "Conteo físico" };
    expect(esquemaAjuste.safeParse(valido).success).toBe(true);
    for (const cambios of [{ motivo: "1234" }, { direccion: "OTRA" }, { cantidad: "0" }, { costoUnitario: "1" }]) {
      expect(esquemaAjuste.safeParse({ ...valido, ...cambios }).success).toBe(false);
    }
  });
  it("exige versión válida", () => {
    expect(esquemaVersion.safeParse({}).success).toBe(false);
    expect(esquemaEditarMaterial.safeParse({ version: "ayer" }).success).toBe(false);
  });
  it("valida filtros, fechas y paginación", () => {
    expect(esquemaConsultaMateriales.parse({})).toMatchObject({ pagina: 1, porPagina: 20, activo: "true" });
    for (const entrada of [{ pagina: 0 }, { porPagina: 101 }, { activo: "quizás" }]) {
      expect(esquemaConsultaMateriales.safeParse(entrada).success).toBe(false);
    }
    expect(esquemaConsultaMovimientos.safeParse({ desde: "2026-10-07", hasta: "2026-10-06" }).success).toBe(false);
    expect(esquemaConsultaMovimientos.safeParse({ desde: "2026-02-30" }).success).toBe(false);
  });
  it.each([
    { activo: true, existencia: "0.000", stockMinimo: "1.000", alerta: "Sin existencia" },
    { activo: true, existencia: "1.000", stockMinimo: "1.000", alerta: "Stock bajo" },
    { activo: true, existencia: "1.001", stockMinimo: "1.000", alerta: null },
    { activo: false, existencia: "0.000", stockMinimo: "1.000", alerta: null },
    { activo: true, existencia: "0.000", stockMinimo: "0.000", alerta: null },
  ])("calcula alerta: activo=$activo existencia=$existencia mínimo=$stockMinimo", ({ activo, existencia, stockMinimo, alerta }) => {
    expect(alertaMaterial({ activo, existencia, stockMinimo })).toBe(alerta);
  });
  it("pone el signo y calcula pendiente sin float", () => {
    expect(cantidadAjuste({ direccion: "DISMINUIR", cantidad: "99999999999.999" })).toBe("-99999999999.999");
    expect(cantidadAjuste({ direccion: "AUMENTAR", cantidad: "0.001" })).toBe("0.001");
    expect(pendienteEstimado("99999999999.999", "99999999999.998")).toBe("0.001");
    expect(pendienteEstimado("1", "2")).toBe("0.000");
  });
  it("incluye el día final completo en Managua", () => {
    const limites = limitesFecha({ desde: "2026-10-06", hasta: "2026-10-06" });
    expect(limites.gte?.toISOString()).toBe("2026-10-06T06:00:00.000Z");
    expect(limites.lt?.toISOString()).toBe("2026-10-07T06:00:00.000Z");
  });
});
