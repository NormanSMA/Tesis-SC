import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaginaPanel from "@/app/(app)/panel/page";
import CargandoPanel from "@/app/(app)/panel/loading";
import ErrorPanel from "@/app/(app)/panel/error";
import { Panel } from "@/modules/panel/componentes/Panel";
import type { PanelDto } from "@/modules/panel/tipos";

const { exigirPermisoPagina, obtenerPanel, replace } = vi.hoisted(() => ({
  exigirPermisoPagina: vi.fn(), obtenerPanel: vi.fn(), replace: vi.fn(),
}));
vi.mock("@/lib/auth/guardia", () => ({ exigirPermisoPagina }));
vi.mock("@/modules/panel/service", () => ({ obtenerPanel }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const inicial: PanelDto = {
  perfil: "ATENCION_CLIENTE",
  perfilesDisponibles: [{ codigo: "ATENCION_CLIENTE", nombre: "Comercial" }],
  generadoEn: "2026-10-10T16:30:00.000Z",
  titulo: "Cotizaciones comerciales", pregunta: "¿Qué necesita atención?",
  indicadores: ["Enviadas", "Aprobadas", "Por vencer", "Ventas"].map((etiqueta, indice) => ({
    id: `${indice}`, etiqueta, valor: `${indice + 1}`, contexto: "Este mes", destino: "/cotizaciones",
  })),
  grafico: {
    titulo: "Cotizaciones por estado", subtitulo: "Este mes", tipo: "barras",
    datos: [{ etiqueta: "Enviadas", valor: 4 }, { etiqueta: "Aprobadas", valor: 2 }],
  },
  atencion: [{ id: "cot-1", titulo: "Cotización por vencer", detalle: "Vence hoy", gravedad: "alta", destino: "/cotizaciones/cot-1" }],
  atencionTotal: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  obtenerPanel.mockResolvedValue(inicial);
  exigirPermisoPagina.mockResolvedValue({ id: "actor-1", perfil: "ATENCION_CLIENTE", perfiles: ["ATENCION_CLIENTE"] });
});

describe("Página del panel", () => {
  it("consulta el servicio con el actor y el perfil solicitado", async () => {
    const pagina = await PaginaPanel({ searchParams: Promise.resolve({ perfil: "ATENCION_CLIENTE" }) });
    expect(exigirPermisoPagina).toHaveBeenCalledWith("panel:ver");
    expect(obtenerPanel).toHaveBeenCalledWith(await exigirPermisoPagina.mock.results[0].value, expect.any(Date), "ATENCION_CLIENTE");
    expect(pagina.props.inicial).toBe(inicial);
  });

  it("acepta el perfil ausente y toma el primero cuando está repetido", async () => {
    await PaginaPanel({ searchParams: Promise.resolve({}) });
    expect(obtenerPanel).toHaveBeenLastCalledWith(expect.anything(), expect.any(Date), undefined);
    await PaginaPanel({ searchParams: Promise.resolve({ perfil: ["ATENCION_CLIENTE", "PRODUCCION"] }) });
    expect(obtenerPanel).toHaveBeenLastCalledWith(expect.anything(), expect.any(Date), "ATENCION_CLIENTE");
  });
});

describe("Interfaz del panel", () => {
  it("compone un encabezado, cuatro indicadores, gráfico y atención", () => {
    const html = renderToStaticMarkup(createElement(Panel, { inicial }));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    for (const indicador of inicial.indicadores) expect(html).toContain(indicador.etiqueta);
    expect(html).toContain("Cotizaciones por estado");
    expect(html).toContain("Enviadas: 4; Aprobadas: 2");
    expect(html).toContain("Cotización por vencer");
    expect(html).toContain('role="status"');
    expect(html).toContain("Actualizado:");
    expect(html).toContain('dateTime="2026-10-10T16:30:00.000Z"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain("Actualizar");
    expect(html).toContain('aria-disabled="false"');
    expect(html).not.toMatch(/<button[^>]*\sdisabled/);
  });

  it("mantiene los indicadores y la atención cuando no hay gráfico", () => {
    const html = renderToStaticMarkup(createElement(Panel, { inicial: { ...inicial, grafico: null, atencion: [] } }));
    expect(html).not.toContain('role="img"');
    expect(html).toContain("Nada requiere atención ahora");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("presenta carga accesible y error con reintento", () => {
    const carga = renderToStaticMarkup(createElement(CargandoPanel));
    expect(carga).toContain('aria-busy="true"');
    expect(carga).toContain('role="status"');
    const error = renderToStaticMarkup(createElement(ErrorPanel, { retry: vi.fn() }));
    expect(error).toContain('role="alert"');
    expect(error).toContain("Reintentar");
  });
});


