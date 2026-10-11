import { describe, expect, it } from "vitest";
import { formatearDescripcionGrafico } from "@/components/panel/GraficoBarras";
import { ordenarPorGravedad } from "@/components/panel/ListaAtencion";
import type { AtencionPanel, GraficoPanel } from "@/modules/panel/tipos";

const grafico: GraficoPanel = {
  titulo: "Monto aprobado por mes",
  subtitulo: "En miles de córdobas",
  tipo: "barras",
  datos: [
    { etiqueta: "Septiembre", valor: 165 },
    { etiqueta: "Octubre", valor: 184.5, destacado: true },
  ],
};

function crearAtencion(id: string, gravedad: AtencionPanel["gravedad"]): AtencionPanel {
  return { id, gravedad, titulo: id, detalle: "Detalle", destino: `/ordenes/${id}` };
}

describe("Descripción accesible del gráfico", () => {
  it("enumera todos los valores, conserva decimales e incluye las unidades", () => {
    expect(formatearDescripcionGrafico(grafico)).toBe(
      "Monto aprobado por mes (En miles de córdobas). Septiembre: 165; Octubre: 184.5.",
    );
  });

  it("describe una serie vacía sin subtítulo", () => {
    expect(formatearDescripcionGrafico({ ...grafico, subtitulo: "", datos: [] })).toBe(
      "Monto aprobado por mes. Sin datos.",
    );
  });

  it("incluye ceros y etiquetas repetidas sin omitir valores", () => {
    expect(formatearDescripcionGrafico({ ...grafico, datos: [
      { etiqueta: "Lunes", valor: 0 }, { etiqueta: "Lunes", valor: 2 },
    ] })).toBe("Monto aprobado por mes (En miles de córdobas). Lunes: 0; Lunes: 2.");
  });
});

describe("Orden de gravedad", () => {
  it("prioriza gravedad alta y conserva el orden dentro de cada gravedad", () => {
    const atencion = [crearAtencion("m1", "media"), crearAtencion("a1", "alta"),
      crearAtencion("m2", "media"), crearAtencion("a2", "alta")];
    expect(ordenarPorGravedad(atencion).map(({ id }) => id)).toEqual(["a1", "a2", "m1", "m2"]);
    expect(atencion.map(({ id }) => id)).toEqual(["m1", "a1", "m2", "a2"]);
  });

  it("acepta una lista congelada sin modificarla", () => {
    const atencion = Object.freeze([crearAtencion("m1", "media"), crearAtencion("a1", "alta")]);
    const ordenada = ordenarPorGravedad(atencion);
    expect(ordenada).not.toBe(atencion);
    expect(ordenada.map(({ id }) => id)).toEqual(["a1", "m1"]);
  });

  it("devuelve una lista vacía cuando no existe atención", () => {
    expect(ordenarPorGravedad([])).toEqual([]);
  });
});
