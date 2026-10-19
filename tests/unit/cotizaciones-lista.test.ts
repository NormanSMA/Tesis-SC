import { beforeEach, describe, expect, it, vi } from "vitest";

import { esquemaConsultaCotizaciones, type ConsultaCotizaciones } from "@/modules/cotizaciones/schema";
import { listarCotizaciones } from "@/modules/cotizaciones/service";

const consultas = vi.hoisted(() => ({ findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { cotizacion: consultas } }));

beforeEach(() => {
  vi.resetAllMocks();
  consultas.findMany.mockResolvedValue([]);
  consultas.groupBy.mockResolvedValue([
    { estado: "BORRADOR", _count: { _all: 2 } },
    { estado: "ENVIADA", _count: { _all: 4 } },
    { estado: "VENCIDA", _count: { _all: 1 } },
  ]);
  consultas.count.mockResolvedValue(1);
});

describe("cotizaciones: consultas paralelas y total filtrado", () => {
  it("inicia los agregados sin esperar las filas y limita la lista a tres consultas", async () => {
    let resolverFilas!: (filas: []) => void;
    consultas.findMany.mockImplementation(() => new Promise<[]>((resolver) => { resolverFilas = resolver; }));
    const pendiente = listarCotizaciones(esquemaConsultaCotizaciones.parse({ estado: "ENVIADA" }));
    expect(consultas.findMany).toHaveBeenCalledOnce();
    expect(consultas.groupBy).toHaveBeenCalledOnce();
    expect(consultas.count).toHaveBeenCalledOnce();
    resolverFilas([]);
    await expect(pendiente).resolves.toMatchObject({ total: 4, conteos: { todas: 7, porVencer: 1 } });
    expect(consultas.findMany.mock.calls.length + consultas.groupBy.mock.calls.length + consultas.count.mock.calls.length).toBe(3);
  });

  const casos: { filtro: Partial<ConsultaCotizaciones>; total: number }[] = [
    { filtro: {}, total: 7 }, { filtro: { estado: "BORRADOR" }, total: 2 },
    { filtro: { estado: "APROBADA" }, total: 0 }, { filtro: { porVencer: "true" }, total: 1 },
    { filtro: { estado: "ENVIADA", porVencer: "true" }, total: 1 },
    { filtro: { estado: "BORRADOR", porVencer: "true" }, total: 0 },
  ];
  it.each(casos)("calcula total $total para $filtro sin otro count", async ({ filtro, total }) => {
    const lista = await listarCotizaciones({ archivadas: "false", pagina: 20, porPagina: 1, ...filtro });
    expect(lista).toMatchObject({ datos: [], total, pagina: 20, porPagina: 1,
      conteos: { BORRADOR: 2, ENVIADA: 4, APROBADA: 0, RECHAZADA: 0, VENCIDA: 1, AJUSTE_SOLICITADO: 0, todas: 7, porVencer: 1 } });
    expect(consultas.count).toHaveBeenCalledOnce();
  });
});
