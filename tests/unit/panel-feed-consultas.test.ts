import { beforeEach, describe, expect, it, vi } from "vitest";
import { consultarCotizacionesFeed, consultarEtapasFeed, consultarMaterialesFeed, consultarOrdenesFeed } from "@/modules/panel/feed-consultas";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRaw } }));
const entrada = { hoy: "2034-05-10", instante: new Date("2034-05-10T12:00:00Z"), actorId: "actor", verDinero: false };
beforeEach(() => { vi.clearAllMocks(); queryRaw.mockResolvedValue([{ filas: [], total: 0 }]); });
function fuenteSql(): string { return queryRaw.mock.calls.at(-1)![1].text; }
describe("consultas del feed", () => {
  it("devuelve el objeto completo sin monto ni moneda y no selecciona total", async () => {
    const fila = { id: "orden", tipo: "orden", codigo: "OT-1", titulo: "Cliente", detalle: "Asigne un responsable",
      urgencia: "SIN_RESPONSABLE", gravedad: "media", monto: null, moneda: null,
      referencia: "2034-05-01T06:00:00+00:00", dias: 9, destino: "/ordenes/orden" };
    queryRaw.mockResolvedValue([{ filas: [fila], total: 6 }]);
    expect(await consultarOrdenesFeed(entrada, "SIN_RESPONSABLE")).toEqual({ total: 6, filas: [{
      id: "orden", tipo: "orden", codigo: "OT-1", titulo: "Cliente", detalle: "Asigne un responsable",
      urgencia: "SIN_RESPONSABLE", gravedad: "media", monto: null, moneda: null,
      referencia: "2034-05-01T06:00:00.000Z", dias: 9, destino: "/ordenes/orden",
    }] });
    expect(fuenteSql()).not.toMatch(/c\.total|JOIN cotizacion/);
    expect(fuenteSql()).toContain("NULL::text AS monto, NULL::text AS moneda");
  });
  it("selecciona dinero solamente con el permiso monetario", async () => {
    await consultarOrdenesFeed({ ...entrada, verDinero: true }, "ORDEN_ATRASADA");
    expect(fuenteSql()).toContain("c.total::text AS monto, c.moneda AS moneda");
    await consultarCotizacionesFeed(entrada, "SIN_RESPUESTA");
    expect(fuenteSql()).not.toContain("c.total");
    await consultarCotizacionesFeed({ ...entrada, verDinero: true }, "POR_VENCER");
    expect(fuenteSql()).toContain("c.total::text AS monto");
  });
  it("aplica LIMIT 5 con conteo independiente en las ocho consultas", async () => {
    for (const urgencia of ["SIN_RESPUESTA", "POR_VENCER", "AJUSTE_SOLICITADO"] as const) await consultarCotizacionesFeed(entrada, urgencia);
    for (const urgencia of ["ORDEN_ATRASADA", "SIN_RESPONSABLE"] as const) await consultarOrdenesFeed(entrada, urgencia);
    await consultarMaterialesFeed(entrada);
    for (const urgencia of ["ETAPA_ATRASADA", "ETAPA_DETENIDA"] as const) await consultarEtapasFeed(entrada, urgencia);
    expect(queryRaw).toHaveBeenCalledTimes(8);
    for (const [plantilla, fuente] of queryRaw.mock.calls) {
      expect(plantilla.join("?")).toContain("LIMIT 5");
      expect(plantilla.join("?")).toContain("count(*)::int AS total");
      expect(fuente.text).not.toMatch(/now\(|current_timestamp/i);
      expect(fuente.values).toContain(entrada.instante);
    }
  });
  it("parametriza los filtros temporales y excluye versiones corregidas", async () => {
    await consultarCotizacionesFeed(entrada, "AJUSTE_SOLICITADO");
    expect(fuenteSql()).toContain("corregida.version > c.version");
    await consultarCotizacionesFeed(entrada, "SIN_RESPUESTA");
    expect(fuenteSql()).toContain("interval '3 days'");
    await consultarEtapasFeed(entrada, "ETAPA_DETENIDA");
    expect(fuenteSql()).toContain("interval '2 days'");
    expect(fuenteSql()).toContain("e.responsable_id =");
    expect(queryRaw.mock.calls.at(-1)![1].values).toContain("actor");
  });
});
