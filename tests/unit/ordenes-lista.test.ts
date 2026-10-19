import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/core/autorizacion";
import { consultarConteosOrdenes, consultarOrdenes } from "@/modules/ordenes/repo";
import { esquemaConsultaOrdenes } from "@/modules/ordenes/schema";
import { listarOrdenes } from "@/modules/ordenes/service";
import { CAMPOS_ORDEN_ORDENES } from "@/modules/ordenes/tipos";

const consultas = vi.hoisted(() => ({ findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn(), etapas: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { ordenTrabajo: consultas, etapaOrden: { groupBy: consultas.etapas } } }));

const actor: Actor = { id: "actor", nombre: "Producción", correo: "produccion@example.com",
  perfil: "PRODUCCION", perfiles: ["PRODUCCION"], permisos: ["orden:ver"] };
const cliente = "11111111-1111-4111-8111-111111111111";
const hoy = "2026-10-18";
const fila = { id: "orden", numero: "OT-2026-0001", estado: "PENDIENTE",
  categoria: { id: "categoria", nombre: "Impresión" }, responsable: null,
  cliente: { id: cliente, nombre: "Cliente", codigoCliente: "CLI-0001", tipo: "EMPRESA", telefono: null, correo: null },
  cotizacion: { id: "cotizacion", numero: "COT-2026-0001", asunto: "Trabajo" },
  fechaEntrega: new Date("2099-01-01"), creadoEn: new Date("2026-10-01"), actualizadoEn: new Date("2026-10-01") };

beforeEach(() => {
  vi.resetAllMocks();
  consultas.findMany.mockResolvedValue([]);
  consultas.groupBy.mockResolvedValue([]);
  consultas.count.mockResolvedValue(0);
  consultas.etapas.mockResolvedValue([]);
});

describe("órdenes: orden seguro", () => {
  for (const campo of CAMPOS_ORDEN_ORDENES) {
    it.each(["asc", "desc"] as const)(`${campo}:%s usa lista blanca y desempata por id`, async (direccion) => {
      const consulta = esquemaConsultaOrdenes.parse({ orden: `${campo}:${direccion}` });
      expect(consulta.orden).toEqual({ campo, direccion });
      await consultarOrdenes(consulta, hoy);
      const principal = campo === "cliente" ? { cliente: { nombre: direccion } } : { [campo]: direccion };
      expect(consultas.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [principal, { id: direccion }] }));
    });
  }

  it("conserva creadoEn desc e id desc sin orden explícito", async () => {
    await consultarOrdenes(esquemaConsultaOrdenes.parse({}), hoy);
    expect(consultas.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ creadoEn: "desc" }, { id: "desc" }] }));
  });

  it.each(["estado:asc", "numero:ASC", "numero:desc:extra", "numero;DROP TABLE:asc", ":asc", "numero:"])(
    "rechaza el orden %s", (orden) => {
      const resultado = esquemaConsultaOrdenes.safeParse({ orden });
      expect(resultado.success).toBe(false);
      if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["orden"]);
    },
  );
});

describe("órdenes: avance agrupado", () => {
  it("calcula completadas sobre etapas no omitidas para toda la página", async () => {
    consultas.findMany.mockResolvedValue([fila, { ...fila, id: "sin-etapas" }, { ...fila, id: "otra" }]);
    consultas.etapas.mockResolvedValue([
      { ordenId: fila.id, estado: "COMPLETADA", _count: { _all: 2 } },
      { ordenId: fila.id, estado: "PENDIENTE", _count: { _all: 3 } },
      { ordenId: fila.id, estado: "EN_CURSO", _count: { _all: 1 } },
      { ordenId: "otra", estado: "COMPLETADA", _count: { _all: 1 } },
    ]);
    const lista = await listarOrdenes(esquemaConsultaOrdenes.parse({}), actor);
    expect(lista.datos.map(({ avance }) => avance)).toEqual([
      { completadas: 2, total: 6 }, { completadas: 0, total: 0 }, { completadas: 1, total: 1 },
    ]);
    expect(consultas.etapas).toHaveBeenCalledExactlyOnceWith({ by: ["ordenId", "estado"],
      where: { ordenId: { in: [fila.id, "sin-etapas", "otra"] }, estado: { not: "OMITIDA" } }, _count: { _all: true } });
  });

  it("omite la consulta de etapas para páginas vacías", async () => {
    const lista = await listarOrdenes(esquemaConsultaOrdenes.parse({ pagina: 20 }), actor);
    expect(lista.datos).toEqual([]);
    expect(consultas.etapas).not.toHaveBeenCalled();
  });
});

describe("órdenes: conteos", () => {
  it("respeta q y cliente y elimina estado, vencidas, responsable y terminales", async () => {
    consultas.groupBy.mockResolvedValue([
      { estado: "PENDIENTE", _count: { _all: 2 } }, { estado: "ENTREGADA", _count: { _all: 3 } },
      { estado: "CERRADA", _count: { _all: 5 } }, { estado: "CANCELADA", _count: { _all: 7 } },
    ]);
    consultas.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    const consulta = esquemaConsultaOrdenes.parse({ q: "100%_\\", cliente, estado: "CANCELADA",
      vencidas: "true", responsable: "sin-responsable", terminales: "true" });
    expect(await consultarConteosOrdenes(consulta, hoy)).toEqual({ PENDIENTE: 2, EN_PRODUCCION: 0, LISTA: 0,
      ENTREGADA: 3, CERRADA: 5, CANCELADA: 7, activas: 5, atrasadas: 4, sinResponsable: 3 });
    const texto = { contains: "100\\%\\_\\\\", mode: "insensitive" };
    const where = { AND: [{ clienteId: cliente }, { OR: [{ numero: texto },
      { cotizacion: { asunto: texto } }, { cliente: { nombre: texto } }] }] };
    expect(consultas.groupBy).toHaveBeenCalledExactlyOnceWith({ by: ["estado"], where, _count: { _all: true } });
    const activas = { estado: { notIn: ["CERRADA", "CANCELADA"] } };
    expect(consultas.count).toHaveBeenNthCalledWith(1, { where: { AND: [where, activas, { fechaEntrega: { lt: new Date(hoy) } }] } });
    expect(consultas.count).toHaveBeenNthCalledWith(2, { where: { AND: [where, activas, { responsableId: null }] } });
  });

  it("inicia filas y conteos en paralelo y conserva el total filtrado", async () => {
    let resolverFilas!: (filas: []) => void;
    consultas.findMany.mockImplementation(() => new Promise<[]>((resolver) => { resolverFilas = resolver; }));
    consultas.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    const pendiente = listarOrdenes(esquemaConsultaOrdenes.parse({ estado: "LISTA", pagina: 2, porPagina: 5 }), actor);
    expect(consultas.findMany).toHaveBeenCalledOnce();
    expect(consultas.groupBy).toHaveBeenCalledOnce();
    expect(consultas.count).toHaveBeenCalledTimes(3);
    resolverFilas([]);
    await expect(pendiente).resolves.toMatchObject({ datos: [], total: 8, pagina: 2, porPagina: 5,
      conteos: { activas: 0, atrasadas: 3, sinResponsable: 2 } });
  });

  it("exige orden:ver antes de consultar", async () => {
    await expect(listarOrdenes(esquemaConsultaOrdenes.parse({}), { ...actor, permisos: [] })).rejects.toMatchObject({ status: 403 });
    expect(consultas.findMany).not.toHaveBeenCalled();
    expect(consultas.groupBy).not.toHaveBeenCalled();
    expect(consultas.count).not.toHaveBeenCalled();
  });
});
