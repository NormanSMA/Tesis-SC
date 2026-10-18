import { describe, expect, it } from "vitest";

import { agruparOtros, formatearCompacto, porcentajeVisible } from "@/lib/listas/numeros";
import { esquemaOrden, leerOrden, textoOrden } from "@/lib/listas/orden";
import { diasTranscurridos, tiempoRelativo } from "@/lib/listas/tiempo-relativo";

const referencia = "2026-10-18T18:00:00.000Z";

describe("tiempoRelativo", () => {
  it.each([
    ["2026-10-18T17:59:40.000Z", "ahora"],
    ["2026-10-18T17:55:00.000Z", "hace 5 min"],
    ["2026-10-18T15:00:00.000Z", "hace 3 h"],
    ["2026-10-17T18:00:00.000Z", "hace 1 día"],
    ["2026-10-14T18:00:00.000Z", "hace 4 días"],
    ["2026-10-18T20:00:00.000Z", "en 2 h"],
    ["2026-10-21T18:00:00.000Z", "en 3 días"],
  ])("%s respecto de la referencia es %s", (fecha, esperado) => {
    expect(tiempoRelativo(fecha, referencia)).toBe(esperado);
  });
  it("es determinista: no depende del reloj del equipo", () => {
    expect(tiempoRelativo("2020-01-01T00:00:00.000Z", "2020-01-02T00:00:00.000Z")).toBe("hace 1 día");
  });
  it("devuelve texto vacío con fechas inválidas", () => {
    expect(tiempoRelativo("no-es-fecha", referencia)).toBe("");
  });
  it("cuenta días completos", () => {
    expect(diasTranscurridos("2026-10-14T19:00:00.000Z", referencia)).toBe(3);
    expect(diasTranscurridos("2026-10-20T00:00:00.000Z", referencia)).toBe(-2);
  });
});

describe("esquemaOrden", () => {
  const esquema = esquemaOrden(["creadoEn", "numero", "total"] as const);
  it("acepta campos de la lista blanca", () => {
    expect(esquema.parse("total:desc")).toEqual({ campo: "total", direccion: "desc" });
    expect(esquema.parse("numero")).toEqual({ campo: "numero", direccion: "asc" });
  });
  it.each(["foo:asc", "total:arriba", "total:asc:extra", "total; DROP TABLE cotizacion", ""])("rechaza %s", (valor) => {
    expect(esquema.safeParse(valor).success).toBe(false);
  });
  it("leerOrden ignora valores fuera de la lista blanca", () => {
    expect(leerOrden("total:desc", ["total"])).toEqual({ campo: "total", direccion: "desc" });
    expect(leerOrden("otro:desc", ["total"])).toBeNull();
    expect(leerOrden(null, ["total"])).toBeNull();
    expect(textoOrden({ campo: "total", direccion: "asc" })).toBe("total:asc");
  });
});

describe("números para gráficos y métricas", () => {
  it("acota el porcentaje visible entre 0 y 100", () => {
    expect(porcentajeVisible(50, 100)).toBe(50);
    expect(porcentajeVisible(150, 100)).toBe(100);
    expect(porcentajeVisible(-5, 100)).toBe(0);
    expect(porcentajeVisible(3, 0)).toBe(0);
    expect(porcentajeVisible(Number.NaN, 10)).toBe(0);
  });
  it("agrupa en Otros cuando hay más categorías que el máximo", () => {
    const serie = [1, 9, 3, 7, 5, 2, 8].map((valor, indice) => ({ clave: `e${indice}`, valor }));
    const resultado = agruparOtros(serie, 6, (valor) => ({ clave: "otros", valor }));
    expect(resultado).toHaveLength(6);
    // Mayores: 9, 8, 7, 5, 3. Otros: 2 + 1.
    expect(resultado.at(-1)).toEqual({ clave: "otros", valor: 3 });
    expect(agruparOtros(serie.slice(0, 3), 6, (valor) => ({ clave: "otros", valor }))).toHaveLength(3);
  });
  it("compacta números grandes", () => {
    expect(formatearCompacto(1_250_000)).toMatch(/1[.,]3\s?M|1[.,]2\s?M/);
  });
});
