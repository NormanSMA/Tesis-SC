import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Actor } from "@/core/autorizacion";
import { esquemaConsultaClientes } from "@/modules/clientes/schema";
import { listarClientes } from "@/modules/clientes/service";
import { CAMPOS_ORDEN_CLIENTE } from "@/modules/clientes/tipos";

const consultas = vi.hoisted(() => ({ findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { cliente: consultas } }));

const actor: Actor = {
  id: "actor", nombre: "Usuario", correo: "usuario@ejemplo.test",
  perfil: "OPERACIONES", perfiles: ["OPERACIONES"], permisos: ["cliente:ver"],
};

beforeEach(() => {
  vi.resetAllMocks();
  consultas.findMany.mockResolvedValue([]);
  consultas.count.mockResolvedValue(2);
  consultas.groupBy.mockResolvedValue([
    { tipo: "EMPRESA", _count: { _all: 2 } },
    { tipo: "PERSONA", _count: { _all: 3 } },
  ]);
});

describe("clientes: orden seguro y conteos", () => {
  it.each(CAMPOS_ORDEN_CLIENTE)("desempata por id en ambas direcciones para %s", async (campo) => {
    for (const direccion of ["asc", "desc"]) {
      await listarClientes(esquemaConsultaClientes.parse({ orden: `${campo}:${direccion}` }), actor);
      const columna = campo === "codigo" ? "codigoCliente" : campo;
      expect(consultas.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        orderBy: [{ [columna]: direccion }, { id: direccion }],
      }));
    }
  });

  it("conserva nombre e id ascendentes por defecto", async () => {
    await listarClientes(esquemaConsultaClientes.parse({}), actor);
    expect(consultas.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
    }));
  });

  it("inicia los conteos sin esperar las filas", async () => {
    let resolverFilas!: (filas: []) => void;
    consultas.findMany.mockImplementation(() => new Promise<[]>((resolver) => { resolverFilas = resolver; }));
    const pendiente = listarClientes(esquemaConsultaClientes.parse({ tipo: "EMPRESA" }), actor);
    expect(consultas.groupBy).toHaveBeenCalledOnce();
    resolverFilas([]);
    await expect(pendiente).resolves.toMatchObject({ total: 2, conteos: { todos: 5, EMPRESA: 2, PERSONA: 3 } });
  });

  it.each(["EMPRESA", "PERSONA", undefined])("omite tipo=%s en conteos y conserva q y activo", async (tipo) => {
    const consulta = esquemaConsultaClientes.parse({ q: "100%_", activo: "false", tipo, pagina: 9, porPagina: 1 });
    const lista = await listarClientes(consulta, actor);
    const filtro = consultas.findMany.mock.calls[0][0].where;
    const filtroConteos = consultas.groupBy.mock.calls[0][0].where;
    expect(filtroConteos).not.toHaveProperty("tipo");
    expect(filtroConteos).toEqual({ activo: false, OR: filtro.OR });
    expect(filtroConteos.OR).toContainEqual({ nombre: { contains: "100\\%\\_", mode: "insensitive" } });
    expect(consultas.count).toHaveBeenCalledWith({ where: filtro });
    expect(filtro.tipo).toBe(tipo);
    expect(lista).toMatchObject({ total: 2, pagina: 9, porPagina: 1, conteos: { todos: 5, EMPRESA: 2, PERSONA: 3 } });
  });

  it("rellena con cero los tipos ausentes", async () => {
    consultas.groupBy.mockResolvedValue([{ tipo: "PERSONA", _count: { _all: 3 } }]);
    expect((await listarClientes(esquemaConsultaClientes.parse({}), actor)).conteos)
      .toEqual({ todos: 3, EMPRESA: 0, PERSONA: 3 });
    consultas.groupBy.mockResolvedValue([]);
    expect((await listarClientes(esquemaConsultaClientes.parse({}), actor)).conteos)
      .toEqual({ todos: 0, EMPRESA: 0, PERSONA: 0 });
  });

  it("expone cotizaciones únicamente con cotizacion:ver", async () => {
    consultas.findMany.mockResolvedValue([{
      id: "cliente", codigoCliente: "CLI-0001", nombre: "Cliente", tipo: "EMPRESA",
      ruc: null, contactoPrincipal: null, telefono: "8888 0000", correo: null,
      activo: true, _count: { cotizaciones: 4 },
    }]);
    const consulta = esquemaConsultaClientes.parse({});
    const sinPermiso = await listarClientes(consulta, actor);
    expect(sinPermiso.datos[0]).not.toHaveProperty("cotizaciones");
    const conPermiso = await listarClientes(consulta, { ...actor, permisos: ["cliente:ver", "cotizacion:ver"] });
    expect(conPermiso.datos[0].cotizaciones).toBe(4);
    expect(conPermiso.conteos).toEqual(sinPermiso.conteos);
  });
});
