import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/core/autorizacion";
import { PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import { obtenerPanel } from "@/modules/panel/service";

const consultas = vi.hoisted(() => ({ perfiles: vi.fn(), comercial: vi.fn(), ordenes: vi.fn(), inventario: vi.fn(), movimientos: vi.fn(), produccion: vi.fn(), clientes: vi.fn() }));
vi.mock("@/modules/panel/repo", () => ({ consultarPerfilesPanel: consultas.perfiles, consultarComercial: consultas.comercial,
  consultarOperacion: consultas.ordenes, consultarMaterialesPanel: consultas.inventario, consultarMovimientos: consultas.movimientos,
  consultarProduccion: consultas.produccion, consultarClientesNuevos: consultas.clientes }));

const instante = new Date("2034-05-10T12:00:00Z");
const actor = (perfil: PerfilCodigo): Actor => ({ id: "actor", nombre: "Actor", correo: "actor@example.test", perfil, perfiles: [perfil], permisos: PERMISOS_POR_PERFIL[perfil] });

beforeEach(() => {
  vi.clearAllMocks();
  consultas.perfiles.mockImplementation(async (perfiles: PerfilCodigo[]) => perfiles.filter((codigo) => codigo !== "ADMIN").map((codigo) => ({ codigo })));
  consultas.comercial.mockResolvedValue({ meses: ["2033-12", "2034-01", "2034-02", "2034-03", "2034-04", "2034-05"].map((mes) => ({ mes: `${mes}-01`, monto: "0", aprobadas: 0, respondidas: 0 })),
    enviadas: 0, porVencer: 0, atencionTotal: 0, filas: [], porEstado: [] });
  consultas.ordenes.mockResolvedValue({ pendientes: 0, sinResponsable: 0, enProduccion: 0, atrasadas: 0, entregas: 0, accion: 0, porEstado: [], filas: [] });
  consultas.inventario.mockResolvedValue({ bajoMinimo: 0, valor: "0", filas: [] });
  consultas.movimientos.mockResolvedValue({ consumosHoy: 0, movimientosSemana: 0, semanas: [] });
  consultas.produccion.mockResolvedValue({ enCurso: 0, pendientes: 0, atrasadas: 0, completadasHoy: 0, atencionTotal: 0, porDia: [], filas: [] });
  consultas.clientes.mockResolvedValue(0);
});

describe("panel: perfiles, permisos y vacíos", () => {
  it.each([
    ["GERENCIA", "Mayo lleva C$\u00A00 aprobados, sin aprobaciones el mes anterior"],
    ["OPERACIONES", "Ninguna orden necesita su acción"],
    ["ATENCION_CLIENTE", "0 cotizaciones esperan respuesta del cliente"],
    ["PRODUCCION", "0 etapas por atender hoy"],
    ["ADMINISTRACION", "El inventario está al día"],
  ] as const)("%s comunica el estado vacío", async (perfil, titulo) => {
    const panel = await obtenerPanel(actor(perfil), instante);
    expect(panel.titulo).toBe(titulo); expect(panel.perfil).toBe(perfil);
    expect(panel.indicadores).toHaveLength(4); expect(panel.atencion).toEqual([]); expect(panel.atencionTotal).toBe(0);
    expect(panel.generadoEn).toBe(instante.toISOString());
    expect(Object.keys(panel).sort()).toEqual(["atencion", "atencionTotal", "generadoEn", "grafico", "indicadores", "perfil", "perfilesDisponibles", "pregunta", "titulo"]);
  });
  it("ADMIN recibe 403 sin consultar datos", async () => {
    await expect(obtenerPanel(actor("ADMIN"), instante)).rejects.toMatchObject({ status: 403 });
    expect(consultas.perfiles).not.toHaveBeenCalled(); expect(consultas.comercial).not.toHaveBeenCalled();
  });
});

describe("panel: selección de perfiles", () => {
  it("elige un perfil asignado y retorna perfiles ordenados", async () => {
    const base = { ...actor("GERENCIA"), perfiles: ["PRODUCCION", "GERENCIA"] as const };
    const panel = await obtenerPanel(base, instante, "PRODUCCION");
    expect(panel.perfil).toBe("PRODUCCION");
    expect(panel.perfilesDisponibles.map((fila) => fila.codigo)).toEqual(["GERENCIA", "PRODUCCION"]);
    expect(consultas.produccion).toHaveBeenCalledWith({ hoy: "2034-05-10", instante, actorId: "actor" });
    expect(consultas.comercial).not.toHaveBeenCalled(); expect(consultas.ordenes).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "OPERACIONES", "desconocido", "", null])("ignora el perfil no disponible %s", async (solicitado) => {
    expect((await obtenerPanel(actor("GERENCIA"), instante, solicitado)).perfil).toBe("GERENCIA");
  });
  it("usa el perfil principal que conserva panel:ver", async () => {
    consultas.perfiles.mockResolvedValue([{ codigo: "PRODUCCION" }]);
    expect((await obtenerPanel({ ...actor("GERENCIA"), perfiles: ["GERENCIA", "PRODUCCION"] }, instante)).perfil).toBe("PRODUCCION");
  });
  it("rechaza actores sin perfiles con permiso de panel", async () => {
    consultas.perfiles.mockResolvedValue([]);
    await expect(obtenerPanel(actor("GERENCIA"), instante)).rejects.toMatchObject({ status: 403 });
  });
});

describe("panel: bloques por permiso", () => {
  it("omite dinero y consultas comerciales sin permiso", async () => {
    const base = actor("GERENCIA");
    const panel = await obtenerPanel({ ...base, permisos: base.permisos.filter((permiso) => permiso !== "cotizacion:ver") }, instante);
    expect(consultas.comercial).not.toHaveBeenCalled(); expect(panel.grafico).toBeNull();
    expect(panel.indicadores.map((fila) => fila.id)).toEqual(["en-produccion", "ordenes-atrasadas"]);
    expect(JSON.stringify(panel)).not.toMatch(/C\$|córdobas/);
  });
  it.each(["GERENCIA", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMINISTRACION"] as const)("%s omite datos sin permisos", async (perfil) => {
    const panel = await obtenerPanel({ ...actor(perfil), permisos: ["panel:ver"] }, instante);
    expect(panel.indicadores).toEqual([]); expect(panel.grafico).toBeNull(); expect(panel.atencionTotal).toBe(0);
    for (const consulta of [consultas.comercial, consultas.ordenes, consultas.inventario, consultas.produccion, consultas.clientes, consultas.movimientos]) {
      expect(consulta).not.toHaveBeenCalled();
    }
  });
  it("Administración omite solamente el valor del inventario sin permiso monetario", async () => {
    const base = actor("ADMINISTRACION");
    const panel = await obtenerPanel({ ...base, permisos: base.permisos.filter((permiso) => permiso !== "cotizacion:ver") }, instante);
    expect(consultas.inventario).toHaveBeenCalledWith(false);
    expect(panel.indicadores.map((fila) => fila.id)).toEqual(["materiales-bajo-minimo", "consumos-hoy", "movimientos-semana"]);
    expect(JSON.stringify(panel)).not.toMatch(/C\$|costo promedio/);
  });
  it.each([
    ["GERENCIA", "orden:ver", "ordenes"], ["GERENCIA", "inventario:ver", "inventario"],
    ["ATENCION_CLIENTE", "cliente:ver", "clientes"], ["ATENCION_CLIENTE", "cotizacion:ver", "comercial"],
    ["PRODUCCION", "orden:ver", "produccion"], ["PRODUCCION", "produccion:ver", "produccion"],
    ["ADMINISTRACION", "inventario:ver", "movimientos"],
  ] as const)("%s no consulta %s revocado", async (perfil, permiso, consulta) => {
    const base = actor(perfil);
    await obtenerPanel({ ...base, permisos: base.permisos.filter((valor) => valor !== permiso) }, instante);
    expect(consultas[consulta]).not.toHaveBeenCalled();
  });
});

describe("panel: prioridad de atención", () => {
  it("Gerencia prioriza órdenes y limita atención sin perder el total", async () => {
    consultas.ordenes.mockResolvedValue({ pendientes: 1, sinResponsable: 0, enProduccion: 2, atrasadas: 4, entregas: 0, accion: 4, porEstado: [],
      filas: Array.from({ length: 4 }, (_, indice) => ({ id: `orden-${indice}`, numero: `OT-${indice}`, dias: 10 - indice, sinResponsable: false })) });
    consultas.inventario.mockResolvedValue({ bajoMinimo: 8, valor: "0", filas: Array.from({ length: 5 }, (_, indice) => ({ id: `material-${indice}`, nombre: "Material", existencia: "0", minimo: "1", unidad: "UNIDAD" })) });
    const panel = await obtenerPanel(actor("GERENCIA"), instante);
    expect(panel.atencion).toHaveLength(5); expect(panel.atencionTotal).toBe(12);
    expect(panel.atencion.slice(0, 4).every((fila) => fila.id.startsWith("orden-"))).toBe(true);
    expect(panel.atencion[4].id).toBe("material-0");
  });
});
