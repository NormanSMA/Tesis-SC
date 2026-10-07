import { describe, expect, it } from "vitest";
import type { EstadoEtapa, EstadoOrden } from "@/generated/prisma/enums";
import { exigirLista, exigirOrdenEditable, exigirTransicionEtapa, validarFechas, validarMotivo, TRANSICIONES_ETAPA } from "@/modules/produccion/reglas";

describe("producción: reglas puras", () => {
  for (const estado of ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CERRADA", "CANCELADA"] as EstadoOrden[]) {
    it(`cambios de etapa con orden ${estado}`, () => {
      const verificar = () => exigirOrdenEditable(estado);
      if (["PENDIENTE", "EN_PRODUCCION"].includes(estado)) expect(verificar).not.toThrow();
      else expect(verificar).toThrow(expect.objectContaining({ codigo: "ORDEN_NO_ADMITE_CAMBIOS_DE_ETAPA" }));
    });
  }
  for (const accion of Object.keys(TRANSICIONES_ETAPA) as (keyof typeof TRANSICIONES_ETAPA)[]) {
    for (const estado of ["PENDIENTE", "EN_CURSO", "COMPLETADA", "OMITIDA"] as EstadoEtapa[]) {
      it(`${accion} desde ${estado}`, () => {
        const transicion = TRANSICIONES_ETAPA[accion];
        if (estado === transicion.desde) expect(exigirTransicionEtapa(estado, accion)).toBe(transicion.hacia);
        else expect(() => exigirTransicionEtapa(estado, accion)).toThrow(expect.objectContaining({ codigo: "TRANSICION_INVALIDA" }));
      });
    }
  }
  it("lista exige cerrar todas las etapas", () => {
    for (const abiertas of [["PENDIENTE"], ["EN_CURSO"], ["COMPLETADA", "PENDIENTE"]] as EstadoEtapa[][]) {
      expect(() => exigirLista(abiertas)).toThrow(expect.objectContaining({ codigo: "ETAPAS_ABIERTAS" }));
    }
  });
  it("lista exige trabajo incluso sin etapas", () => {
    for (const estados of [[], ["OMITIDA"], ["OMITIDA", "OMITIDA"]] as EstadoEtapa[][]) {
      expect(() => exigirLista(estados)).toThrow(expect.objectContaining({ codigo: "ORDEN_SIN_TRABAJO" }));
    }
    expect(() => exigirLista(["COMPLETADA", "OMITIDA"])).not.toThrow();
  });
  it("valida fechas combinadas con valores existentes", () => {
    expect(() => validarFechas("2026-10-10", "2026-10-09")).toThrow();
    expect(() => validarFechas("2026-10-10", "2026-10-10")).not.toThrow();
    expect(() => validarFechas(null, "2026-10-09")).not.toThrow();
  });
  it("normaliza y exige motivo", () => {
    expect(validarMotivo("  Motivo de retrabajo  ")).toBe("Motivo de retrabajo");
    for (const motivo of ["", "    ", "abcd", "x".repeat(10001)]) expect(() => validarMotivo(motivo)).toThrow();
  });
});
