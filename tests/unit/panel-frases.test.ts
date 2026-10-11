import { describe, expect, it } from "vitest";
import { cantidadPanel, dineroPanel, META_APROBACION_PCT, tasaAprobacion, tendenciaMonto, tendenciaTasa, tituloGerencia } from "@/modules/panel/dto";
import type { MesComercial } from "@/modules/panel/tipos";

const mes = (monto: string, fecha = "2034-10-01"): MesComercial => ({ mes: fecha, monto, aprobadas: 0, respondidas: 0 });
describe("panel: frases y formatos", () => {
  it.each([["184500.00", "C$ 184,500"], ["184500.25", "C$ 184,500.25"], ["0", "C$ 0"],
    ["99999999999999.995", "C$ 100,000,000,000,000"]])("formatea exactamente %s", (valor, esperado) => {
    expect(dineroPanel(valor)).toBe(esperado);
  });
  it("formatea conteos y conserva la meta nombrada", () => {
    expect(cantidadPanel(1234)).toBe("1,234"); expect(META_APROBACION_PCT).toBe(70);
  });
  it("comunica crecimiento, reducción y estabilidad", () => {
    expect(tituloGerencia(mes("184500"), mes("164700", "2034-09-01"))).toBe("Octubre lleva C$ 184,500 aprobados, 12 % más que septiembre");
    expect(tituloGerencia(mes("50"), mes("100", "2034-09-01"))).toBe("Octubre lleva C$ 50 aprobados, 50 % menos que septiembre");
    expect(tituloGerencia(mes("50"), mes("50", "2034-09-01"))).toBe("Octubre lleva C$ 50 aprobados, igual que septiembre");
  });
  it("comunica el mes anterior sin aprobaciones sin dividir entre cero", () => {
    expect(tituloGerencia(mes("0"), mes("0", "2034-09-01"))).toBe("Octubre lleva C$ 0 aprobados, sin aprobaciones el mes anterior");
    expect(tendenciaMonto("100", "0")).toEqual({ direccion: "sube", texto: "sin aprobaciones el mes anterior" });
  });
  it("calcula tendencias exactas con montos fuera del rango seguro de Number", () => {
    expect(tendenciaMonto("100000000000000.01", "100000000000000.00").direccion).toBe("sube");
  });
  it("calcula aprobación y tendencia en puntos", () => {
    const actual = { ...mes("0"), aprobadas: 7, respondidas: 10 };
    const anterior = { ...mes("0"), aprobadas: 3, respondidas: 5 };
    expect(tasaAprobacion(actual)).toBe(70); expect(tasaAprobacion(mes("0"))).toBe(0);
    expect(tendenciaTasa(actual, anterior)).toEqual({ direccion: "sube", texto: "10 puntos frente al mes anterior" });
    expect(tendenciaTasa(anterior, actual)).toEqual({ direccion: "baja", texto: "-10 puntos frente al mes anterior" });
    expect(tendenciaTasa(actual, actual).direccion).toBe("igual");
  });
});
