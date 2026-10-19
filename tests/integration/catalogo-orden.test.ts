import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { ProductoDto } from "@/modules/catalogo/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, cargarModuloCatalogo, invocar, unico, type ModuloCatalogo, type Sesion } from "./catalogo-ayudas";

describeConBase("catálogo: orden de la lista de productos", () => {
  const db = crearClientePropietario();
  const token = unico("Ord");
  const ids = [randomUUID(), randomUUID()].sort();
  let modulos: ModuloCatalogo;
  let sesion: Sesion;
  const nombres: Record<string, string> = {};

  beforeAll(async () => {
    await sembrarReferencia(db);
    modulos = await cargarModuloCatalogo();
    sesion = await abrirSesion(db, modulos, "OPERACIONES");
    const categoriaId = (await db.categoria.create({ data: { nombre: unico("Categoría") } })).id;
    const filas = [
      { clave: "A", id: randomUUID(), precioBase: "30.00", creadoEn: "2000-01-01T00:00:00Z" },
      { clave: "B1", id: ids[0], nombre: "B", precioBase: "10.00", creadoEn: "2000-01-02T00:00:00Z" },
      { clave: "B2", id: ids[1], nombre: "B", precioBase: "10.00", creadoEn: "2000-01-02T00:00:00Z" },
      { clave: "C", id: randomUUID(), precioBase: "20.00", creadoEn: "2000-01-03T00:00:00Z" },
    ];
    for (const fila of filas) {
      await db.producto.create({ data: { id: fila.id, codigo: unico("P"), nombre: `${token}-${fila.nombre ?? fila.clave}`,
        categoriaId, unidadCobro: "UNIDAD", precioBase: fila.precioBase, creadoEn: new Date(fila.creadoEn) } });
      nombres[fila.id] = fila.clave;
    }
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  const listar = (orden?: string) => invocar<ProductoDto[]>(modulos.productos.GET,
    peticion("GET", `/api/v1/productos?${new URLSearchParams({ q: token, ...(orden ? { orden } : {}) })}`, { cookie: sesion.cookie }));
  const claves = async (orden?: string) => (await listar(orden)).datos.map((producto) => nombres[producto.id]);

  it("usa nombre ascendente con desempate por id cuando falta el parámetro", async () => {
    expect(await claves()).toEqual(["A", "B1", "B2", "C"]);
  });
  it("ordena por nombre en ambas direcciones con desempate por id", async () => {
    expect(await claves("nombre:asc")).toEqual(["A", "B1", "B2", "C"]);
    expect(await claves("nombre:desc")).toEqual(["C", "B2", "B1", "A"]);
  });
  it("ordena por precio en ambas direcciones con desempate por id", async () => {
    expect(await claves("precio:asc")).toEqual(["B1", "B2", "C", "A"]);
    expect(await claves("precio:desc")).toEqual(["A", "C", "B2", "B1"]);
  });
  it("ordena por fecha de creación en ambas direcciones con desempate por id", async () => {
    expect(await claves("creadoEn:desc")).toEqual(["C", "B2", "B1", "A"]);
    expect(await claves("creadoEn:asc")).toEqual(["A", "B1", "B2", "C"]);
  });
  it.each(["codigo:asc", "nombre:arriba", "nombre:asc:x", "precio'; DROP TABLE producto;--"])(
    "responde 422 para orden=%s", async (orden) => {
      const respuesta = await listar(orden);
      expect(respuesta.status).toBe(422);
      expect(respuesta.error?.campos?.orden).toBeTruthy();
    });
});
