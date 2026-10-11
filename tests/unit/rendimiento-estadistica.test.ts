import { describe, expect, it } from "vitest";

import { decidirCumplimiento, percentil, resumir } from "../../scripts/rendimiento.mjs";

describe("percentiles de RNF-01", () => {
  it("aplica rango más cercano y ordena numéricamente sin modificar la entrada", () => {
    const valores = [100, 2, 30, 4];
    expect(percentil(valores, 50)).toBe(4);
    expect(percentil(valores, 95)).toBe(100);
    expect(valores).toEqual([100, 2, 30, 4]);
  });

  it("resuelve los límites y una muestra única", () => {
    expect(percentil([25, 5, 10], 0)).toBe(5);
    expect(percentil([25, 5, 10], 100)).toBe(25);
    expect(percentil([17], 99)).toBe(17);
    expect(percentil([], 95)).toBeNull();
  });

  it("calcula p50, p95 y p99 para cien muestras", () => {
    const valores = Array.from({ length: 100 }, (_, indice) => indice + 1);
    expect(percentil(valores, 50)).toBe(50);
    expect(percentil(valores, 95)).toBe(95);
    expect(percentil(valores, 99)).toBe(99);
  });

  it.each([-1, 101, NaN, Infinity])("rechaza el percentil inválido %s", (valor) => {
    expect(() => percentil([1], valor)).toThrow(RangeError);
  });

  it.each([-1, NaN, Infinity])("rechaza la duración inválida %s", (valor) => {
    expect(() => percentil([valor], 50)).toThrow(RangeError);
  });
});

describe("resumen de RNF-01", () => {
  it("incluye exactamente 2000 ms y penaliza las peticiones sin respuesta", () => {
    const resumen = resumir([
      { ms: 2000, respondio: true },
      { ms: 2000.01, respondio: true },
      { ms: 10, respondio: false },
      { ms: 100, respondio: true },
    ]);
    expect(resumen).toEqual({
      n: 4, p50: 100, p95: 2000.01, p99: 2000.01,
      maximo: 2000.01, porcentajeHasta2000: 50,
    });
  });

  it("representa una muestra vacía sin inventar duraciones", () => {
    expect(resumir([])).toEqual({
      n: 0, p50: null, p95: null, p99: null, maximo: null, porcentajeHasta2000: 0,
    });
  });
});

function resumenConPorcentaje(porcentaje: number) {
  return { n: 100, p50: 1, p95: 1, p99: 1, maximo: 1, porcentajeHasta2000: porcentaje };
}

function resumenesConPorcentaje(porcentaje = 95) {
  return Object.fromEntries(
    ["global", "consulta", "creacion", "actualizacion"].map((tipo) => [tipo, resumenConPorcentaje(porcentaje)]),
  );
}

const condicionesCompletas = { duracionAlcanzada: true, errores4xxInesperados: 0 };

describe("decisión de RNF-01", () => {
  it("acepta exactamente 95 % sin errores 5xx", () => {
    expect(decidirCumplimiento(resumenesConPorcentaje(), 0, condicionesCompletas)).toBe(true);
  });

  it.each(["global", "consulta", "creacion", "actualizacion"])("rechaza %s por debajo de 95 %", (tipo) => {
    const resumenes = resumenesConPorcentaje(100);
    resumenes[tipo] = resumenConPorcentaje(94.9999);
    expect(decidirCumplimiento(resumenes, 0, condicionesCompletas)).toBe(false);
  });

  it("rechaza cualquier error 5xx aunque las respuestas sean rápidas", () => {
    expect(decidirCumplimiento(resumenesConPorcentaje(100), 1, condicionesCompletas)).toBe(false);
  });

  it("rechaza una duración incompleta aunque las respuestas sean rápidas", () => {
    expect(decidirCumplimiento(resumenesConPorcentaje(100), 0,
      { ...condicionesCompletas, duracionAlcanzada: false })).toBe(false);
  });

  it.each([1, 372])("rechaza %s respuestas 4xx inesperadas aunque sean rápidas", (cantidad) => {
    expect(decidirCumplimiento(resumenesConPorcentaje(100), 0,
      { ...condicionesCompletas, errores4xxInesperados: cantidad })).toBe(false);
  });

  it.each(["global", "consulta", "creacion", "actualizacion"])("rechaza p95 de %s superior a 2000 ms", (tipo) => {
    const resumenes = resumenesConPorcentaje(100);
    resumenes[tipo].p95 = 2000.01;
    expect(decidirCumplimiento(resumenes, 0, condicionesCompletas)).toBe(false);
  });

  it("acepta p95 exactamente igual a 2000 ms para cada tipo", () => {
    const resumenes = resumenesConPorcentaje();
    for (const resumen of Object.values(resumenes)) resumen.p95 = 2000;
    expect(decidirCumplimiento(resumenes, 0, condicionesCompletas)).toBe(true);
  });

  it("rechaza los tipos sin muestras o ausentes", () => {
    const resumenes = resumenesConPorcentaje(100);
    resumenes.actualizacion = { ...resumenes.actualizacion, n: 0 };
    expect(decidirCumplimiento(resumenes, 0, condicionesCompletas)).toBe(false);
    delete resumenes.actualizacion;
    expect(decidirCumplimiento(resumenes, 0, condicionesCompletas)).toBe(false);
  });
});
