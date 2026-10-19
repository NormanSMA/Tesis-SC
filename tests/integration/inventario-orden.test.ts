import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MaterialDto, MovimientoDto } from "@/modules/inventario/dto";
import { esquemaConsultaMateriales, esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { clienteInventario, crearMaterial, invocar, prepararInventario, recibir, type EntornoInventario } from "./inventario-ayudas";

describe("inventario: orden de las listas con ordenar=campo:direccion", () => {
  const db = clienteInventario();
  const marca = `ORD${randomUUID().slice(0, 8)}`;
  let entorno: EntornoInventario;
  let ids: { b: string; a1: string; a2: string; c: string };
  beforeAll(async () => {
    entorno = await prepararInventario(db);
    // Nombres B, A, A (empate) y C; existencias 5, 9, 1, 0; fechas de creación en orden inverso al nombre.
    const [b, a1, a2, c] = await Promise.all([["B", "5.000"], ["A", "9.000"], ["A", "1.000"], ["C", null]].map(async ([letra, cantidad]) => {
      const material = await crearMaterial(entorno, { nombre: `${marca} ${letra}`, codigo: `${marca}-${randomUUID().slice(0, 6)}` });
      if (cantidad) await recibir(entorno, material.id, { cantidad });
      return material;
    }));
    ids = { b: b.id, a1: a1.id, a2: a2.id, c: c.id };
    for (const [indice, id] of [c.id, a2.id, a1.id, b.id].entries()) {
      await db.material.update({ where: { id }, data: { creadoEn: new Date(Date.UTC(2026, 0, 1 + indice)) } });
    }
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const actor = () => entorno.sesiones.OPERACIONES.actor;
  const materiales = async (ordenar?: string) => (await entorno.modulos.servicio.listarMateriales(
    esquemaConsultaMateriales.parse({ q: marca, ...(ordenar && { ordenar }) }), actor())).datos.map((fila) => fila.id);
  const porId = (primero: string, segundo: string) => (primero < segundo ? [primero, segundo] : [segundo, primero]);

  it("materiales: por defecto ordena por nombre ascendente con desempate por id", async () => {
    const [a1, a2] = porId(ids.a1, ids.a2);
    expect(await materiales()).toEqual([a1, a2, ids.b, ids.c]);
    expect(await materiales("nombre:asc")).toEqual([a1, a2, ids.b, ids.c]);
  });
  it("materiales: nombre descendente invierte también el desempate", async () => {
    const [a1, a2] = porId(ids.a1, ids.a2);
    expect(await materiales("nombre:desc")).toEqual([ids.c, ids.b, a2, a1]);
  });
  it("materiales: fecha de creación ascendente y descendente", async () => {
    expect(await materiales("creadoEn:asc")).toEqual([ids.c, ids.a2, ids.a1, ids.b]);
    expect(await materiales("creadoEn:desc")).toEqual([ids.b, ids.a1, ids.a2, ids.c]);
  });
  it("materiales: menor existencia primero y solo acepta la lista blanca", async () => {
    expect(await materiales("existencia:asc")).toEqual([ids.c, ids.a2, ids.b, ids.a1]);
    expect(await materiales("existencia:desc")).toEqual([ids.a1, ids.b, ids.a2, ids.c]);
  });
  it("materiales: la API responde 422 con un campo o dirección inválidos", async () => {
    const cookie = entorno.sesiones.OPERACIONES.cookie;
    const bueno = await invocar<MaterialDto[]>(entorno.modulos.lista.GET, peticion("GET", `/api/v1/materiales?q=${marca}&ordenar=nombre:desc`, { cookie }));
    expect(bueno.status).toBe(200); expect(bueno.datos[0].id).toBe(ids.c);
    for (const ordenar of ["precio:asc", "nombre:arriba", "nombre:asc:x", "codigo"]) {
      const malo = await invocar(entorno.modulos.lista.GET, peticion("GET", `/api/v1/materiales?q=${marca}&ordenar=${ordenar}`, { cookie }));
      expect(malo.status, ordenar).toBe(422);
    }
  });

  describe("movimientos", () => {
    const idsMovimientos = async (ordenar?: string, extra: Record<string, string> = {}) => (await entorno.modulos.servicio.listarMovimientos(
      esquemaConsultaMovimientos.parse({ material: ids.a1, ...extra, ...(ordenar && { ordenar }) }), actor())).datos.map((fila) => fila.id);
    let creados: string[];
    let inicial: string;
    beforeAll(async () => {
      // La entrada inicial de a1 es la más reciente (hoy). Se agregan dos movimientos con la misma marca de tiempo (empate) y uno posterior, en marzo.
      inicial = (await db.movimientoInventario.findFirstOrThrow({ where: { materialId: ids.a1 } })).id;
      const base = new Date("2026-03-10T12:00:00.000Z");
      creados = [];
      for (const dias of [0, 0, 1]) {
        creados.push((await db.movimientoInventario.create({ data: { materialId: ids.a1, tipo: "ENTRADA",
          cantidad: "1", costoUnitario: "1", usuarioId: entorno.sesiones.ADMINISTRACION.usuarioId,
          creadoEn: new Date(base.getTime() + dias * 86_400_000) } })).id);
      }
    });
    it("por defecto es más recientes primero y desempata por id descendente", async () => {
      const [empate1, empate2, tardio] = creados;
      const [menor, mayor] = porId(empate1, empate2);
      const lista = await idsMovimientos();
      expect(lista).toEqual([inicial, tardio, mayor, menor]);
      expect(await idsMovimientos("creadoEn:desc")).toEqual(lista);
    });
    it("más antiguos primero desempata por id ascendente", async () => {
      const [empate1, empate2, tardio] = creados;
      const [menor, mayor] = porId(empate1, empate2);
      const lista = await idsMovimientos("creadoEn:asc");
      expect(lista).toEqual([menor, mayor, tardio, inicial]);
    });
    it("conserva los filtros de fecha junto con el orden", async () => {
      const [empate1, empate2] = creados;
      const [menor, mayor] = porId(empate1, empate2);
      expect(await idsMovimientos("creadoEn:asc", { desde: "2026-03-10", hasta: "2026-03-10" })).toEqual([menor, mayor]);
      expect(await idsMovimientos("creadoEn:desc", { desde: "2026-03-10", hasta: "2026-03-10" })).toEqual([mayor, menor]);
    });
    it("la API responde 422 con un orden inválido y acepta el válido", async () => {
      const cookie = entorno.sesiones.OPERACIONES.cookie;
      const bueno = await invocar<MovimientoDto[]>(entorno.modulos.movimientos.GET,
        peticion("GET", `/api/v1/movimientos?material=${ids.a1}&ordenar=creadoEn:asc`, { cookie }));
      expect(bueno.status).toBe(200); expect(bueno.datos.at(-1)?.id).toBe(inicial);
      for (const ordenar of ["existencia:asc", "creadoEn:arriba", "creadoEn:asc:x"]) {
        const malo = await invocar(entorno.modulos.movimientos.GET, peticion("GET", `/api/v1/movimientos?ordenar=${ordenar}`, { cookie }));
        expect(malo.status, ordenar).toBe(422);
      }
    });
  });
});
