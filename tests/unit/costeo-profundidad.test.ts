import { describe, expect, it } from "vitest";
import { costearItemCatalogo, validarItemCatalogo } from "@/core/costeo";
import { calcularConsumoEstimado } from "@/core/consumo-estimado";
import { leerDecimal, formatear } from "@/core/decimal";
import { superficiePieza, textoMedidas } from "@/core/medidas";
import { superficieTotal } from "@/modules/cotizaciones/materiales";

const r = (texto: string) => leerDecimal(texto)!;

describe("profundidad: caja abierta", () => {
  it("sin profundidad conserva ancho × alto", () => {
    expect(formatear(superficiePieza(r("1"), r("0.5"), null), 3)).toBe("0.500");
  });

  it("con profundidad suma los cuatro laterales: 1 × 0,5 × 0,1 = 0,8 m²", () => {
    expect(formatear(superficiePieza(r("1"), r("0.5"), r("0.1")), 3)).toBe("0.800");
  });

  it("el precio por m² usa la superficie con profundidad", () => {
    const item = costearItemCatalogo({ unidadCobro: "M2", precioBase: "100.00", cantidad: "2", ancho: "1", alto: "0.5", profundidad: "0.1" });
    expect(item.importe).toBe("160.00");
    expect(item.profundidad).toBe("0.100");
    const plano = costearItemCatalogo({ unidadCobro: "M2", precioBase: "100.00", cantidad: "2", ancho: "1", alto: "0.5" });
    expect(plano.importe).toBe("100.00");
    expect(plano.profundidad).toBeNull();
  });

  it("rechaza profundidad cero o negativa", () => {
    expect(validarItemCatalogo({ unidadCobro: "M2", precioBase: "1", cantidad: "1", ancho: "1", alto: "1", profundidad: "0" }))
      .toHaveProperty("profundidad");
  });

  it("el material en m² de el trabajo y el consumo estimado usan la misma superficie", () => {
    expect(superficieTotal({ ancho: "1", alto: "0.5", profundidad: "0.1", cantidad: "2" })).toBe("1.600");
    const { consumos } = calcularConsumoEstimado({ unidadesMaterial: { m1: "M2" }, items: [{ secuencia: 1, tipo: "CATALOGO",
      unidadCobro: "M2", cantidad: "2", ancho: "1", alto: "0.5", profundidad: "0.1", receta: [{ materialId: "m1", cantidad: "1" }] }] });
    expect(consumos[0].cantidad).toBe("1.600");
  });

  it("muestra la tercera medida solo si existe", () => {
    expect(textoMedidas({ ancho: "1.000", alto: "0.500", profundidad: null })).toBe("1.000 × 0.500 m");
    expect(textoMedidas({ ancho: "1.000", alto: "0.500", profundidad: "0.100" })).toBe("1.000 × 0.500 × 0.100 m");
  });
});
