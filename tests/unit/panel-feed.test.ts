import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/core/autorizacion";
import type { FilaOperativaDto, PerfilPanel } from "@/modules/panel/tipos";
import { consultarFeed } from "@/modules/panel/feed";

const fuentes = vi.hoisted(() => ({ cotizaciones: vi.fn(), ordenes: vi.fn(), materiales: vi.fn(), etapas: vi.fn() }));
vi.mock("@/modules/panel/feed-consultas", () => ({ consultarCotizacionesFeed: fuentes.cotizaciones,
  consultarOrdenesFeed: fuentes.ordenes, consultarMaterialesFeed: fuentes.materiales, consultarEtapasFeed: fuentes.etapas }));
const actor: Actor = { id: "actor", nombre: "Actor", correo: "actor@example.test", perfil: "GERENCIA", perfiles: ["GERENCIA"],
  permisos: ["cotizacion:ver", "orden:ver", "inventario:ver", "produccion:ver"] };
const instante = new Date("2034-05-10T12:00:00Z");
const entrada = { actor, hoy: "2034-05-10", instante };
const fila = (id: string, gravedad: FilaOperativaDto["gravedad"], dias: number): FilaOperativaDto => ({
  id, tipo: "orden", codigo: id, titulo: "Cliente", detalle: "Revise la entrega", urgencia: "ORDEN_ATRASADA",
  gravedad, dias, monto: null, moneda: null, referencia: "2034-05-01T06:00:00.000Z", destino: `/ordenes/${id}`,
});
beforeEach(() => {
  vi.clearAllMocks();
  for (const fuente of Object.values(fuentes)) fuente.mockResolvedValue({ filas: [], total: 0 });
});
describe("feed operativo", () => {
  it.each([
    { perfil: "GERENCIA", llamadas: [3, 2, 1, 0] }, { perfil: "ATENCION_CLIENTE", llamadas: [3, 0, 0, 0] },
    { perfil: "OPERACIONES", llamadas: [0, 2, 0, 0] }, { perfil: "PRODUCCION", llamadas: [0, 0, 0, 2] },
    { perfil: "ADMINISTRACION", llamadas: [0, 0, 1, 0] },
  ] as const)("consulta las fuentes de $perfil", async ({ perfil, llamadas }) => {
    const [cotizaciones, ordenes, materiales, etapas] = llamadas;
    await consultarFeed({ ...entrada, perfil });
    expect(fuentes.cotizaciones).toHaveBeenCalledTimes(cotizaciones);
    expect(fuentes.ordenes).toHaveBeenCalledTimes(ordenes);
    expect(fuentes.materiales).toHaveBeenCalledTimes(materiales);
    expect(fuentes.etapas).toHaveBeenCalledTimes(etapas);
  });
  it("consulta las ocho urgencias", async () => {
    for (const perfil of ["GERENCIA", "PRODUCCION"] as const) await consultarFeed({ ...entrada, perfil });
    expect([...fuentes.cotizaciones.mock.calls, ...fuentes.ordenes.mock.calls, ...fuentes.etapas.mock.calls]
      .map((llamada) => llamada[1])).toEqual(["SIN_RESPUESTA", "POR_VENCER", "AJUSTE_SOLICITADO",
      "ORDEN_ATRASADA", "SIN_RESPONSABLE", "ETAPA_ATRASADA", "ETAPA_DETENIDA"]);
    expect(fuentes.materiales).toHaveBeenCalledOnce();
  });
  it("ordena por gravedad y días, limita ocho y conserva el total", async () => {
    fuentes.cotizaciones.mockResolvedValue({ filas: [fila("media", "media", 100)], total: 7 });
    fuentes.ordenes.mockResolvedValueOnce({ filas: [9, 4, 7, 6, 5].map((dias) => fila(`alta-${dias}`, "alta", dias)), total: 12 })
      .mockResolvedValueOnce({ filas: [fila("alta-8", "alta", 8), fila("alta-3", "alta", 3)], total: 2 });
    const panel = await consultarFeed({ ...entrada, perfil: "GERENCIA" });
    expect(panel.atencion).toHaveLength(8);
    expect(panel.atencion.slice(0, 7).map(({ dias }) => dias)).toEqual([9, 8, 7, 6, 5, 4, 3]);
    expect(panel.atencion[7].gravedad).toBe("media");
    expect(panel.atencionTotal).toBe(35);
  });
  it.each(["GERENCIA", "ATENCION_CLIENTE", "OPERACIONES", "PRODUCCION", "ADMINISTRACION"] as PerfilPanel[])("respeta permisos en %s", async (perfil) => {
    expect(await consultarFeed({ ...entrada, perfil, actor: { ...actor, permisos: [] } })).toEqual({ atencion: [], atencionTotal: 0 });
    for (const fuente of Object.values(fuentes)) expect(fuente).not.toHaveBeenCalled();
  });
  it("inicia todas las fuentes antes de esperar resultados", async () => {
    let terminar!: (valor: { filas: FilaOperativaDto[]; total: number }) => void;
    fuentes.cotizaciones.mockReturnValue(new Promise((resolver) => { terminar = resolver; }));
    const pendiente = consultarFeed({ ...entrada, perfil: "GERENCIA" });
    expect(fuentes.cotizaciones).toHaveBeenCalledTimes(3);
    expect(fuentes.ordenes).toHaveBeenCalledTimes(2);
    expect(fuentes.materiales).toHaveBeenCalledOnce();
    terminar({ filas: [], total: 0 });
    await pendiente;
  });
});
