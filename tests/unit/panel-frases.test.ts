import { describe, expect, it } from "vitest";
import { comparacionPanel, mesAnterior, cantidadMaterialPanel, cantidadPanel, dineroPanel, etiquetaDia, etiquetaSemana, mesesConActividad, META_APROBACION_PCT, nombreMesCorto, tasaAprobacion, tendenciaMonto, tendenciaTasa, tituloGerencia } from "@/modules/panel/dto";
import type { MesComercial } from "@/modules/panel/tipos";

const mes = (monto: string, fecha = "2034-10-01"): MesComercial => ({ mes: fecha, monto, aprobadas: 0, respondidas: 0 });
describe("panel: frases y formatos", () => {
  it.each([[6, 3, 100], [1, 4, -75], [3, 3, 0], [0, 0, null], [7, 0, null]])("compara %s contra %s", (actual, anterior, esperado) => {
    const comparacion = comparacionPanel(actual!, anterior!, "ayer");
    expect(comparacion.porcentaje).toBe(esperado);
    expect(comparacion.texto).toContain("ayer");
    expect(comparacion.texto).not.toMatch(/NaN|Infinity/);
  });
  it("retrocede de enero a diciembre", () => {
    expect(mesAnterior("2034-01-31")).toBe("2033-12-01");
  });
  it.each([["184500.00", "C$\u00A0184,500"], ["184500.25", "C$\u00A0184,500"], ["1174042.59", "C$\u00A01,174,043"], ["0", "C$\u00A00"],
    ["99999999999999.995", "C$\u00A0100,000,000,000,000"]])("formatea exactamente %s", (valor, esperado) => {
    expect(dineroPanel(valor)).toBe(esperado);
  });
  it("formatea conteos y conserva la meta nombrada", () => {
    expect(cantidadPanel(1234)).toBe("1,234"); expect(META_APROBACION_PCT).toBe(70);
  });
  it("comunica crecimiento, reducción y estabilidad", () => {
    expect(tituloGerencia(mes("184500"), mes("164700", "2034-09-01"))).toBe("Octubre lleva C$\u00A0184,500 aprobados, 12 % más que septiembre");
    expect(tituloGerencia(mes("50"), mes("100", "2034-09-01"))).toBe("Octubre lleva C$\u00A050 aprobados, 50 % menos que septiembre");
    expect(tituloGerencia(mes("50"), mes("50", "2034-09-01"))).toBe("Octubre lleva C$\u00A050 aprobados, igual que septiembre");
  });
  it("comunica el mes anterior sin aprobaciones sin dividir entre cero", () => {
    expect(tituloGerencia(mes("0"), mes("0", "2034-09-01"))).toBe("Octubre lleva C$\u00A00 aprobados, sin aprobaciones el mes anterior");
    expect(tendenciaMonto("100", "0")).toEqual({ direccion: "sube", texto: "sin aprobaciones el mes anterior" });
  });
  it("calcula tendencias exactas con montos fuera del rango seguro de Number", () => {
    expect(tendenciaMonto("100000000000000.01", "100000000000000.00").direccion).toBe("sube");
  });
  it("calcula aprobación y tendencia en puntos", () => {
    const actual = { ...mes("0"), aprobadas: 7, respondidas: 10 };
    const anterior = { ...mes("0"), aprobadas: 3, respondidas: 5 };
    expect(tasaAprobacion(actual)).toBe(70); expect(tasaAprobacion(mes("0"))).toBe(0);
    expect(tendenciaTasa(actual, anterior)).toEqual({ direccion: "sube", texto: "10 pts" });
    expect(tendenciaTasa(anterior, actual)).toEqual({ direccion: "baja", texto: "10 pts" });
    expect(tendenciaTasa(actual, actual).direccion).toBe("igual");
  });
  it("abrevia meses y días para los gráficos", () => {
    expect(nombreMesCorto("2034-09-01")).toBe("sep");
    expect(etiquetaDia("2026-10-05")).toBe("lun 5");
    expect(etiquetaDia("2026-10-11")).toBe("dom 11");
    expect(etiquetaSemana("2026-10-05")).toBe("5 oct");
  });
  it("omite los meses vacíos iniciales y conserva al menos los dos últimos", () => {
    const meses = (montos: string[]) => montos.map((monto, indice) => ({ ...mes(monto), mes: `2034-0${indice + 1}-01` }));
    expect(mesesConActividad(meses(["0", "0", "5", "0", "7", "9"])).map((fila) => fila.mes[6])).toEqual(["3", "4", "5", "6"]);
    expect(mesesConActividad(meses(["0", "0", "0", "0", "0", "0"])).map((fila) => fila.mes[6])).toEqual(["5", "6"]);
    expect(mesesConActividad(meses(["0", "0", "0", "0", "0", "3"])).map((fila) => fila.mes[6])).toEqual(["5", "6"]);
  });
  it("muestra cantidades de materiales sin ceros sobrantes", () => {
    expect(cantidadMaterialPanel("0.000", "UNIDAD")).toBe("0");
    expect(cantidadMaterialPanel("5.000", "Pliego")).toBe("5");
    expect(cantidadMaterialPanel("2.500", "METRO")).toBe("2.5");
    expect(cantidadMaterialPanel("10.000", "METRO")).toBe("10");
  });
});
