import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => createElement("img", { alt }),
}));

import { METADATOS_APP, NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "@/core/marca";
import { Marca } from "@/components/layout/Marca";

describe("marca visible", () => {
  it("la plataforma se llama TRACORE y la empresa Soluciones Creativas", () => {
    expect(NOMBRE_PLATAFORMA).toBe("TRACORE");
    expect(NOMBRE_EMPRESA).toBe("Soluciones Creativas");
  });

  it("el título y la descripción del documento usan TRACORE", () => {
    expect(METADATOS_APP.title.default).toContain("TRACORE");
    expect(METADATOS_APP.title.template).toContain("TRACORE");
    expect(METADATOS_APP.description).toContain("TRACORE");
  });

  it("el componente de marca muestra TRACORE y la empresa como subtítulo", () => {
    const html = renderToStaticMarkup(createElement(Marca));
    expect(html).toContain("TRACORE");
    expect(html).toContain("Soluciones Creativas");
    expect(html).not.toContain("Plataforma de gestión");
  });
});
