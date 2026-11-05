import { describe, expect, it } from "vitest";

import { desplazarAnios, FECHA_MINIMA, hoyManagua, rangoConsulta, rangoPlanificacion } from "@/core/fechas";
import { esquemaFechaConsulta, fechaFiltroNavegable } from "@/lib/listas/fecha";
import { esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { validarFechaEntrega } from "@/modules/ordenes/reglas";
import { validarRangoPlan } from "@/modules/produccion/reglas";
import { esquemaConsultaBitacora } from "@/modules/trazabilidad/schema";

const HOY = "2026-11-04";
const camposDe = (accion: () => void) => {
  try {
    accion();
  } catch (error) {
    return (error as { campos?: Record<string, string> }).campos;
  }
  return undefined;
};

describe("desplazarAnios", () => {
  it("suma y resta años conservando el día", () => {
    expect(desplazarAnios(HOY, 1)).toBe("2027-11-04");
    expect(desplazarAnios(HOY, -1)).toBe("2025-11-04");
  });
  it("pasa el 29 de febrero al 28 en años no bisiestos", () => {
    expect(desplazarAnios("2028-02-29", 1)).toBe("2029-02-28");
    expect(desplazarAnios("2028-02-29", -1)).toBe("2027-02-28");
  });
});

describe("fecha de entrega", () => {
  it("acepta de hoy a un año después", () => {
    expect(() => validarFechaEntrega(HOY, HOY)).not.toThrow();
    expect(() => validarFechaEntrega("2027-11-04", HOY)).not.toThrow();
  });
  it("rechaza el pasado y más de un año adelante", () => {
    expect(camposDe(() => validarFechaEntrega("2026-11-03", HOY))?.fechaEntrega).toBe("La fecha de entrega no puede ser anterior a hoy.");
    for (const fecha of ["2027-11-05", "2099-12-31", "9999-12-31"]) {
      expect(camposDe(() => validarFechaEntrega(fecha, HOY))?.fechaEntrega).toBe("La fecha de entrega no puede superar un año desde hoy.");
    }
  });
});

describe("planificación de etapas", () => {
  it("acepta un año antes y después de hoy, y fechas vacías", () => {
    expect(rangoPlanificacion(HOY)).toEqual({ minimo: "2025-11-04", maximo: "2027-11-04" });
    expect(() => validarRangoPlan({ fechaInicioPlan: "2025-11-04", fechaFinPlan: "2027-11-04" }, HOY)).not.toThrow();
    expect(() => validarRangoPlan({ fechaInicioPlan: null, fechaFinPlan: undefined }, HOY)).not.toThrow();
  });
  it("rechaza cada fecha fuera del rango en su campo", () => {
    expect(camposDe(() => validarRangoPlan({ fechaInicioPlan: "2025-11-03" }, HOY))).toHaveProperty("fechaInicioPlan");
    expect(camposDe(() => validarRangoPlan({ fechaFinPlan: "2027-11-05" }, HOY))).toHaveProperty("fechaFinPlan");
    expect(camposDe(() => validarRangoPlan({ fechaInicioPlan: "0001-01-01" }, HOY))).toHaveProperty("fechaInicioPlan");
  });
});

describe("filtros de consulta", () => {
  const hoy = hoyManagua();
  const maximo = rangoConsulta(hoy).maximo;
  it("aceptan desde el año 2000 hasta un año después de hoy", () => {
    for (const fecha of [FECHA_MINIMA, hoy, maximo]) expect(esquemaFechaConsulta.safeParse(fecha).success).toBe(true);
  });
  it("rechazan años extremos", () => {
    for (const fecha of ["1999-12-31", "0001-01-01", desplazarAnios(maximo, 1), "9999-12-31"]) {
      expect(esquemaFechaConsulta.safeParse(fecha).success).toBe(false);
    }
  });
  it("bitácora y movimientos de inventario usan el mismo límite", () => {
    for (const esquema of [esquemaConsultaBitacora, esquemaConsultaMovimientos]) {
      expect(esquema.safeParse({ desde: "2025-01-01", hasta: hoy }).success).toBe(true);
      expect(esquema.safeParse({ desde: "0002-01-01" }).success).toBe(false);
      expect(esquema.safeParse({ hasta: "9999-12-31" }).success).toBe(false);
    }
  });
  it("no navegan con los valores intermedios al teclear el año", () => {
    for (const valor of ["0002-01-01", "0020-01-01", "0202-01-01"]) expect(fechaFiltroNavegable(valor)).toBe(false);
    expect(fechaFiltroNavegable("")).toBe(true);
    expect(fechaFiltroNavegable(hoy)).toBe(true);
  });
});
