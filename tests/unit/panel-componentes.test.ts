import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatearDescripcionGrafico, GraficoBarrasEstados } from "@/components/panel/GraficoBarrasEstados";
import { ListaAtencion, ordenarPorGravedad, tiempoAtencion } from "@/components/panel/ListaAtencion";
import { TarjetaIndicador } from "@/modules/panel/componentes/TarjetaIndicador";
import { URGENCIAS } from "@/components/panel/urgencias";
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
  return { id, gravedad, tipo: "orden", codigo: id, urgencia: "ORDEN_ATRASADA", monto: null, moneda: null, referencia: "2034-05-01T06:00:00.000Z", dias: 9, titulo: id, detalle: "Detalle", destino: `/ordenes/${id}` };
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

describe("Gráfico compacto de estados", () => {
  it("agrupa en seis categorías, conserva el total y expone una tabla accesible", () => {
    const datos = Array.from({ length: 8 }, (_, indice) => ({ etiqueta: `Estado ${indice}`, valor: indice + 1 }));
    const html = renderToStaticMarkup(createElement(GraficoBarrasEstados, { grafico: { ...grafico, datos } }));
    expect(html.match(/animate-bar-grow-x/g)).toHaveLength(6);
    expect(html).toContain("Otros: 6");
    expect(html).toContain('animation-delay:200ms');
    expect(html).toContain('<div class="sr-only"><table>');
    expect(html).toContain('<th scope="row">Otros</th><td>6</td>');
    expect(datos.map(({ valor }) => valor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("mantiene el orden cronológico en series de tiempo y no agrupa en Otros", () => {
    const datos = Array.from({ length: 8 }, (_, indice) => ({ clave: `2034-05-0${indice + 1}`, etiqueta: `día ${indice + 1}`, valor: 8 - indice }));
    const html = renderToStaticMarkup(createElement(GraficoBarrasEstados, { grafico: { ...grafico, datos } }));
    expect(html).not.toContain("Otros");
    expect(html.indexOf("día 2")).toBeLessThan(html.indexOf("día 8"));
    expect(html).not.toContain(">día 1<");
  });

  it("conserva ceros y distingue la categoría destacada", () => {
    const html = renderToStaticMarkup(createElement(GraficoBarrasEstados, { grafico: {
      ...grafico, datos: [{ etiqueta: "Vacío", valor: 0 }, { etiqueta: "Actual", valor: 1, destacado: true }],
    } }));
    expect(html).toContain("width:0%");
    expect(html).toContain("bg-primary");
    expect(html).toContain("bg-slate-400");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});

describe("Feed operativo", () => {
  const generadoEn = "2034-05-10T12:00:00.000Z";
  const fila = { ...crearAtencion("OT-1", "alta"), referencia: "2034-05-07T12:00:00.000Z", dias: 3 };

  it.each([
    { urgencia: "SIN_RESPUESTA", referencia: "2034-05-06T12:00:00.000Z", dias: 4, esperado: "Hace 4 días" },
    { urgencia: "POR_VENCER", referencia: "2034-05-12T12:00:00.000Z", dias: 2, esperado: "Vence en 2 días" },
    { urgencia: "POR_VENCER", referencia: "2034-05-10T06:00:00.000Z", dias: 0, esperado: "Vence hoy" },
    { urgencia: "ORDEN_ATRASADA", referencia: "2034-05-07T12:00:00.000Z", dias: 3, esperado: "3 días de atraso" },
  ] as const)("calcula $urgencia desde generadoEn", ({ urgencia, referencia, dias, esperado }) => {
    expect(tiempoAtencion({ ...fila, urgencia, referencia, dias }, generadoEn)).toBe(esperado);
  });

  it("muestra moneda, insignia, tiempo, total y enlace a la lista", () => {
    const html = renderToStaticMarkup(createElement(ListaAtencion, {
      generadoEn, atencionTotal: 12, atencion: [{ ...fila, monto: "1250.50", moneda: "USD" }],
    }));
    expect(html).toContain("US$ 1,251");
    expect(html).toContain("3 días de atraso");
    // Insignia blanca con punto rojo (estilo Mise) para la urgencia alta.
    expect(html).toMatch(/size-1\.5 rounded-full bg-danger"><\/span>Atrasada/);
    expect(html).toContain("12 elementos requieren atención");
    expect(html).toContain('href="/ordenes"');
    expect(html).toContain("Ver todas");
    expect(html).toContain("animate-row-enter");
  });

  it("omite montos ocultos y no propone una lista para fuentes mezcladas", () => {
    const html = renderToStaticMarkup(createElement(ListaAtencion, {
      generadoEn, atencionTotal: 2, atencion: [fila, { ...fila, id: "cot-2", destino: "/cotizaciones/cot-2" }],
    }));
    expect(html).not.toContain("US$");
    expect(html).not.toContain("C$");
    expect(html).not.toContain("Ver todas");
  });

  it("presenta el estado cero con ayuda y define las ocho urgencias", () => {
    const html = renderToStaticMarkup(createElement(ListaAtencion, { generadoEn, atencionTotal: 0, atencion: [] }));
    expect(html).toContain("Todo al día");
    expect(html).toContain("No hay elementos que requieran atención ahora.");
    expect(Object.keys(URGENCIAS)).toHaveLength(8);
  });
});

describe("Indicadores operativos", () => {
  it("con tendencia, el pie muestra el contexto; invierte el color y muestra la meta en el anillo", () => {
    const html = renderToStaticMarkup(createElement(TarjetaIndicador, { indicador: {
      id: "tasa", etiqueta: "Tasa de aprobación", numero: 64, valor: "64 %", formato: "porcentaje",
      meta: 70, destino: "/cotizaciones", contexto: "Contexto secundario", mejorSiBaja: true,
      comparacion: { porcentaje: -2, texto: "vs. mes anterior" }, tendencia: { direccion: "baja", texto: "2 %" },
    } }));
    expect(html).toContain("meta 70 %");
    expect(html).toContain("text-success");
    expect(html).toContain("Contexto secundario");
    expect(html).not.toContain("vs. mes anterior");
    expect(html).toContain('role="img"');
  });
  it("sin tendencia, el pie muestra la comparación con el periodo anterior", () => {
    const html = renderToStaticMarkup(createElement(TarjetaIndicador, { indicador: {
      id: "clientes", etiqueta: "Clientes nuevos", numero: 3, valor: "3", formato: "entero",
      destino: "/clientes", contexto: "Contexto secundario",
      comparacion: { porcentaje: 50, texto: "+50 % vs. el mes anterior" },
    } }));
    expect(html).toContain("+50 % vs. el mes anterior");
    expect(html).not.toContain("Contexto secundario");
  });
});
