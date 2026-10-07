import { describe, expect, it } from "vitest";
import { esquemaAgregarEtapa, esquemaCrearArea, esquemaCrearPlantilla, esquemaEditarArea, esquemaEditarEtapa,
  esquemaEditarPlantilla, esquemaOmitirEtapa, esquemaRetrabajo, esquemaTablero, esquemaVersion } from "@/modules/produccion/schema";

const id = "11111111-1111-4111-8111-111111111111";
const version = "2026-10-06T12:00:00.000Z";
describe("producción: esquemas", () => {
  it("etapa manual requiere nombre y área", () => {
    expect(esquemaAgregarEtapa.parse({ nombre: "  Impresión  ", areaId: id })).toEqual({ nombre: "Impresión", areaId: id });
    for (const entrada of [{}, { nombre: " ", areaId: id }, { nombre: "x".repeat(81), areaId: id }, { nombre: "Diseño", areaId: "falso" }]) {
      expect(esquemaAgregarEtapa.safeParse(entrada).success).toBe(false);
    }
  });
  it("PATCH permite nulos y rechaza fechas inválidas", () => {
    expect(esquemaEditarEtapa.safeParse({ version, responsableId: null, fechaFinPlan: null }).success).toBe(true);
    for (const entrada of [{}, { version, responsableId: "falso" }, { version, fechaInicioPlan: "2026-02-30" },
      { version, fechaInicioPlan: "2026-10-09", fechaFinPlan: "2026-10-08" }]) expect(esquemaEditarEtapa.safeParse(entrada).success).toBe(false);
  });
  it("normaliza UUID de cuerpos para conservar operaciones sin cambios", () => {
    const mayusculas = "ABCDEFAB-1234-4123-ABCD-123456789ABC";
    expect(esquemaEditarEtapa.parse({ version, responsableId: mayusculas }).responsableId).toBe(mayusculas.toLowerCase());
    expect(esquemaEditarPlantilla.parse({ version, areaId: mayusculas }).areaId).toBe(mayusculas.toLowerCase());
  });
  it("cada acción exige versión de instante", () => {
    expect(esquemaVersion.safeParse({ version }).success).toBe(true);
    for (const valor of [undefined, "", "2026-10-06", "versión"]) expect(esquemaVersion.safeParse({ version: valor }).success).toBe(false);
  });
  it("omitir y retrabajo exigen motivo", () => {
    expect(esquemaOmitirEtapa.safeParse({ version, motivo: "No aplica" }).success).toBe(true);
    expect(esquemaRetrabajo.safeParse({ version, nombre: "Corrección", areaId: id, motivo: "Rehacer" }).success).toBe(true);
    expect(esquemaRetrabajo.safeParse({ version, nombre: "Corrección", areaId: id, motivo: " abc " }).success).toBe(false);
    expect(esquemaOmitirEtapa.safeParse({ version }).success).toBe(false);
  });
  it("áreas exigen nombre y versión al editar", () => {
    expect(esquemaCrearArea.safeParse({ nombre: "Carpintería" }).success).toBe(true);
    expect(esquemaCrearArea.safeParse({ nombre: " " }).success).toBe(false);
    expect(esquemaEditarArea.safeParse({ nombre: "Carpintería", version }).success).toBe(true);
    expect(esquemaEditarArea.safeParse({ nombre: "Carpintería" }).success).toBe(false);
  });
  it("plantillas exigen secuencias enteras positivas", () => {
    for (const secuencia of [0, -1, 1.2, 1000001, "1"]) expect(esquemaCrearPlantilla.safeParse({ nombre: "Diseño", areaId: id, secuencia }).success).toBe(false);
    expect(esquemaCrearPlantilla.safeParse({ nombre: "Diseño", areaId: id, secuencia: 1 }).success).toBe(true);
    expect(esquemaEditarPlantilla.safeParse({ version, secuencia: 2 }).success).toBe(true);
  });
  it("tablero admite solo estados abiertos", () => {
    expect(esquemaTablero.safeParse({ estado: "EN_CURSO", area: id, responsable: id, q: "OT-2026" }).success).toBe(true);
    for (const entrada of [{ estado: "COMPLETADA" }, { area: "falso" }, { responsable: "falso" }, { q: "x".repeat(201) }]) {
      expect(esquemaTablero.safeParse(entrada).success).toBe(false);
    }
  });
});
