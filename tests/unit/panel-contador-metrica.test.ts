import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContadorMetrica } from "@/components/comunes/ContadorMetrica";

// El número animado es aria-hidden: es lo que se ve en pantalla. El formato usa espacio duro.
function visible(html: string): string {
  return (/<span aria-hidden="true">([^<]*)<\/span>/.exec(html)?.[1] ?? "").replace(/ /g, " ");
}

describe("Contador de métricas", () => {
  it("redondea a entero por defecto, como el panel", () => {
    const html = renderToStaticMarkup(createElement(ContadorMetrica, { numero: 0.3, texto: "C$ 0.30", formato: "moneda" }));
    expect(visible(html)).toBe("C$ 0");
    expect(html).toContain("C$ 0.30");
  });

  it("con textoExacto muestra los decimales del servidor", () => {
    const html = renderToStaticMarkup(createElement(ContadorMetrica, {
      numero: 66.67, texto: "66.67 %", formato: "porcentaje", textoExacto: true,
    }));
    expect(visible(html)).toBe("66.67 %");
  });

  it("con textoExacto no compacta cifras grandes", () => {
    const html = renderToStaticMarkup(createElement(ContadorMetrica, {
      numero: 1_234_567.89, texto: "C$ 1,234,567.89", formato: "moneda", textoExacto: true,
    }));
    expect(visible(html)).toBe("C$ 1,234,567.89");
    expect(html).not.toContain("title=");
  });

  it("sin dato muestra guion aunque pida texto exacto", () => {
    const html = renderToStaticMarkup(createElement(ContadorMetrica, { numero: null, texto: "", formato: "moneda", textoExacto: true }));
    expect(visible(html)).toBe("—");
  });
});
