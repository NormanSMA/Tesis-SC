import { beforeEach, expect, it, vi } from "vitest";
import type { Actor } from "@/core/autorizacion";
import { PERMISOS_POR_PERFIL, type PerfilCodigo } from "@/core/permisos";
import { obtenerContadores, resumirContadores } from "@/modules/navegacion/contadores";

const { consultar } = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: consultar } }));
const instante = new Date("2034-05-10T05:59:59Z");
function actor(perfil: PerfilCodigo): Actor {
  return { id: "00000000-0000-4000-8000-000000000001", nombre: "Prueba", correo: "prueba@example.com",
    perfil, perfiles: [perfil], permisos: PERMISOS_POR_PERFIL[perfil] };
}
beforeEach(() => { consultar.mockReset(); consultar.mockResolvedValue([{ total: 0, atrasadas: 0 }]); });

it("omite ceros y conserva los tonos sin modificar las filas", () => {
  const filas = [
    { ruta: "/cotizaciones", contador: { total: 0, tono: "neutro" as const } },
    { ruta: "/ordenes", contador: { total: 3, tono: "peligro" as const } },
    { ruta: "/inventario", contador: { total: 2, tono: "peligro" as const } },
  ];
  expect(resumirContadores(filas)).toEqual({
    "/ordenes": { total: 3, tono: "peligro" }, "/inventario": { total: 2, tono: "peligro" },
  });
  expect(filas).toHaveLength(3);
});

it.each([
  ["GERENCIA", 4], ["ADMINISTRACION", 4], ["OPERACIONES", 4],
  ["ATENCION_CLIENTE", 3], ["PRODUCCION", 2], ["ADMIN", 0],
] as const)("%s consulta únicamente los módulos permitidos", async (perfil, consultas) => {
  consultar.mockResolvedValue([{ total: 1, atrasadas: 0 }]);
  const contadores = await obtenerContadores(actor(perfil), instante);
  expect(consultar).toHaveBeenCalledTimes(consultas);
  expect(Object.keys(contadores)).toHaveLength(consultas);
  expect(Boolean(contadores["/cotizaciones"])).toBe(PERMISOS_POR_PERFIL[perfil].includes("cotizacion:ver"));
  expect(Boolean(contadores["/inventario"])).toBe(PERMISOS_POR_PERFIL[perfil].includes("inventario:ver"));
});

it("omite módulos sin alertas y eleva el tono de órdenes atrasadas", async () => {
  consultar.mockResolvedValueOnce([{ total: 0, atrasadas: 0 }])
    .mockResolvedValueOnce([{ total: 3, atrasadas: 1 }])
    .mockResolvedValueOnce([{ total: 2, atrasadas: 0 }])
    .mockResolvedValueOnce([{ total: 0, atrasadas: 0 }]);
  expect(await obtenerContadores(actor("GERENCIA"), instante)).toEqual({
    "/ordenes": { total: 3, tono: "peligro" }, "/inventario": { total: 2, tono: "peligro" },
  });
});

it("mantiene el tono neutro cuando solo falta responsable", async () => {
  consultar.mockResolvedValue([{ total: 2, atrasadas: 0 }]);
  const contadores = await obtenerContadores({ ...actor("PRODUCCION"), permisos: ["orden:ver"] }, instante);
  expect(contadores).toEqual({ "/ordenes": { total: 2, tono: "neutro" } });
});

it("parametriza la fecha de Managua y el actor sin recuperar filas del feed", async () => {
  await obtenerContadores(actor("GERENCIA"), instante);
  const consultas = consultar.mock.calls.map(([consulta]) => consulta);
  expect(consultas[0].values).toContain(instante);
  expect(consultas[0].values).toContain("2034-05-09");
  expect(consultas[0].text).toContain("corregida.version > c.version");
  expect(consultas[2].text).toContain("existencia <= stock_minimo");
  expect(consultas[3].values).toContain(actor("GERENCIA").id);
  for (const consulta of consultas) {
    expect(consulta.text).toContain("count(*)");
    expect(consulta.text).not.toMatch(/jsonb_agg|LIMIT|00000000/);
  }
});

it("inicia todas las consultas antes de esperar sus resultados", async () => {
  const resolver: ((filas: { total: number; atrasadas: number }[]) => void)[] = [];
  consultar.mockImplementation(() => new Promise((resolve) => resolver.push(resolve)));
  const pendiente = obtenerContadores(actor("GERENCIA"), instante);
  expect(consultar).toHaveBeenCalledTimes(4);
  resolver.forEach((resolve) => resolve([{ total: 0, atrasadas: 0 }]));
  expect(await pendiente).toEqual({});
});
