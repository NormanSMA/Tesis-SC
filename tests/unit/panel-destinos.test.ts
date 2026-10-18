import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodObject } from "zod";

import { can } from "@/core/autorizacion";
import { esquemaConsultaClientes } from "@/modules/clientes/schema";
import { esquemaConsultaCotizaciones } from "@/modules/cotizaciones/schema";
import { esquemaConsultaMateriales } from "@/modules/inventario/schema";
import { esquemaConsultaOrdenes } from "@/modules/ordenes/schema";
import { construirPanel } from "@/modules/panel/paneles";
import type { PerfilPanel } from "@/modules/panel/tipos";

vi.mock("@/modules/panel/feed", () => ({ consultarFeed: vi.fn(async () => ({ atencion: [], atencionTotal: 0 })) }));
vi.mock("@/core/autorizacion", () => ({ can: vi.fn(() => true) }));
vi.mock("@/modules/panel/repo", () => ({
  consultarOperacion: vi.fn(async () => ({
    pendientes: 2, sinResponsable: 1, enProduccion: 3, entregas: 2, entregadasAnteriores: 1, accion: 1,
    porEstado: [{ etiqueta: "PENDIENTE", valor: 2 }], filas: [],
  })),
  consultarComercial: vi.fn(async () => ({
    enviadas: 2, porVencer: 1, atencionTotal: 0, filas: [],
    porEstado: [{ etiqueta: "ENVIADA", valor: 2 }],
    meses: Array.from({ length: 6 }, (_, indice) => ({
      mes: `2026-${String(indice + 5).padStart(2, "0")}`,
      aprobadas: indice === 4 ? 7 : 3, respondidas: 10, monto: "100.00",
    })),
  })),
  consultarClientesNuevos: vi.fn(async () => 2),
  consultarProduccion: vi.fn(async () => ({
    enCurso: 1, pendientes: 2, completadasHoy: 1, atrasadas: 0, atencionTotal: 0,
    porDia: [{ etiqueta: "2026-10-12", valor: 1 }], filas: [],
  })),
  consultarMaterialesPanel: vi.fn(async () => ({ bajoMinimo: 0, valor: "100.00", filas: [] })),
  consultarMovimientos: vi.fn(async () => ({
    consumosHoy: 1, movimientosSemana: 3,
    semanas: [{ etiqueta: "2026-10-12", valor: 1 }],
  })),
}));

const raiz = path.resolve(import.meta.dirname, "..", "..");
const fuente = readFileSync(path.join(raiz, "src", "modules", "panel", "paneles.ts"), "utf8");
const destinos = [...fuente.matchAll(/destino: "([^"]+)"/g)].map(([, destino]) => destino);

const ESQUEMAS: Record<string, ZodObject> = {
  "/ordenes": esquemaConsultaOrdenes,
  "/inventario": esquemaConsultaMateriales,
  "/cotizaciones": esquemaConsultaCotizaciones,
  "/clientes": esquemaConsultaClientes,
};

const PANELES: { perfil: PerfilPanel; destino: string }[] = [
  { perfil: "OPERACIONES", destino: "/ordenes" },
  { perfil: "ATENCION_CLIENTE", destino: "/cotizaciones" },
  { perfil: "PRODUCCION", destino: "/produccion" },
  { perfil: "ADMINISTRACION", destino: "/inventario" },
];
const entrada = {
  actor: { id: "actor-panel" } as Parameters<typeof construirPanel>[0]["actor"],
  hoy: "2026-10-12", instante: new Date("2026-10-12T12:00:00Z"),
};

function validarDestino(destino: string): void {
  const [ruta, consulta = ""] = destino.split("?");
  const esquema = ESQUEMAS[ruta];
  if (!esquema) {
    expect(["/produccion", "/reportes"], `${destino}: lista desconocida`).toContain(ruta);
    expect(consulta, `${destino}: filtros sin esquema de consulta`).toBe("");
    return;
  }
  const parametros = Object.fromEntries(new URLSearchParams(consulta));
  for (const clave of Object.keys(parametros)) {
    expect(Object.keys(esquema.shape), `${destino}: el filtro "${clave}" no existe`).toContain(clave);
  }
  expect(esquema.safeParse(parametros).success, `${destino}: valor de filtro inválido`).toBe(true);
}

describe("destinos del panel", () => {
  beforeEach(() => {
    vi.mocked(can).mockReturnValue(true);
  });

  it("detecta los destinos del panel", () => {
    expect(destinos.length).toBeGreaterThan(10);
  });

  it("cada parámetro de filtro existe en el esquema de consulta de la lista y su valor es válido", () => {
    for (const destino of destinos) validarDestino(destino);
  });

  it.each(PANELES)("el gráfico de $perfil enlaza a su lista con filtros válidos", async ({ perfil, destino }) => {
    const panel = await construirPanel({ ...entrada, perfil });
    expect(panel.grafico?.nota?.texto).toBeTruthy();
    expect(panel.grafico?.nota?.destino).toBe(destino);
    validarDestino(panel.grafico!.nota!.destino);
  });

  it.each(PANELES)("cada indicador de $perfil incluye una meta o comparación textual", async ({ perfil }) => {
    const panel = await construirPanel({ ...entrada, perfil });
    expect(panel.indicadores).toHaveLength(4);
    for (const indicador of panel.indicadores) {
      expect(indicador.contexto, indicador.id).toMatch(/^(Meta:|Mes anterior:) .+/);
      validarDestino(indicador.destino);
    }
  });

  it("compara las aprobadas con el mes anterior disponible", async () => {
    const panel = await construirPanel({ ...entrada, perfil: "ATENCION_CLIENTE" });
    expect(panel.indicadores.find(({ id }) => id === "aprobadas-mes")).toMatchObject({
      valor: "3", contexto: "Mes anterior: 7 aprobadas",
    });
  });

  it.each([
    { perfil: "GERENCIA", ids: ["ordenes-atrasadas"] },
    { perfil: "OPERACIONES", ids: ["por-iniciar", "sin-responsable"] },
    { perfil: "ATENCION_CLIENTE", ids: ["enviadas", "por-vencer"] },
    { perfil: "PRODUCCION", ids: ["mis-etapas-pendientes", "mis-etapas-atrasadas"] },
    { perfil: "ADMINISTRACION", ids: ["materiales-bajo-minimo"] },
  ] as const)("marca como favorable reducir los indicadores pendientes de $perfil", async ({ perfil, ids }) => {
    const panel = await construirPanel({ ...entrada, perfil });
    for (const id of ids) {
      expect(panel.indicadores.find((indicador) => indicador.id === id)?.mejorSiBaja, id).toBe(true);
    }
  });

  it("conserva contexto y enlace de inventario sin permiso de cotizaciones", async () => {
    vi.mocked(can).mockImplementation((_actor, permiso) => permiso !== "cotizacion:ver");
    const panel = await construirPanel({ ...entrada, perfil: "ADMINISTRACION" });
    expect(panel.indicadores).toHaveLength(3);
    expect(panel.indicadores.some(({ id }) => id === "valor-inventario")).toBe(false);
    for (const indicador of panel.indicadores) expect(indicador.contexto).toMatch(/^Meta: /);
    expect(panel.grafico?.nota?.destino).toBe("/inventario");
  });

  it.each(PANELES)("no muestra enlaces ni indicadores de $perfil sin permisos", async ({ perfil }) => {
    vi.mocked(can).mockReturnValue(false);
    const panel = await construirPanel({ ...entrada, perfil });
    expect(panel.indicadores).toEqual([]);
    expect(panel.grafico).toBeNull();
  });
});
