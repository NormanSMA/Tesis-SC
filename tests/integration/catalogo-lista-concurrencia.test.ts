import { afterAll, beforeAll, expect, it } from "vitest";

import type { FichaProducto, ProductoDto } from "@/modules/catalogo/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, cargarModuloCatalogo, crearMaterial, crearProductoDirecto, invocar, unico, type ModuloCatalogo, type Sesion } from "./catalogo-ayudas";

describeConBase("catálogo: listas y concurrencia", () => {
  const db = crearClientePropietario();
  let modulos: ModuloCatalogo;
  let operaciones: Sesion;
  let categoriaId: string;
  beforeAll(async () => {
    await sembrarReferencia(db); modulos = await cargarModuloCatalogo();
    operaciones = await abrirSesion(db, modulos, "OPERACIONES");
    categoriaId = (await db.categoria.create({ data: { nombre: unico("Categoría") } })).id;
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  const lista = (consulta: string) => invocar<ProductoDto[]>(modulos.productos.GET, peticion("GET", `/api/v1/productos?${consulta}`, { cookie: operaciones.cookie }));
  const receta = (producto: { id: string; actualizadoEn: Date }, materialId: string, cantidad: string) => invocar<FichaProducto>(modulos.receta.PUT,
    peticion("PUT", "/", { cookie: operaciones.cookie, cuerpo: { version: producto.actualizadoEn.toISOString(), materiales: [{ materialId, cantidad }] } }), producto.id);

  it("busca nombre, código y descripción sin distinguir mayúsculas", async () => {
    const producto = await crearProductoDirecto(db, categoriaId, { descripcion: unico("Descripción") });
    for (const texto of [producto.nombre, producto.codigo, producto.descripcion as string]) {
      expect((await lista(`q=${encodeURIComponent(texto.toLowerCase())}`)).datos.map((fila) => fila.id)).toContain(producto.id);
    }
  });
  it("escapa los comodines de búsqueda", async () => {
    const prefijo = unico("Literal");
    const producto = await crearProductoDirecto(db, categoriaId, { nombre: `${prefijo}%_` });
    await crearProductoDirecto(db, categoriaId, { nombre: `${prefijo}AB` });
    expect((await lista(`q=${encodeURIComponent(`${prefijo}%_`)}`)).datos.map((fila) => fila.id)).toEqual([producto.id]);
  });
  it("filtra estado y categoría con paginación estable para nombres iguales", async () => {
    const nombre = unico("Igual");
    const productos = await Promise.all(Array.from({ length: 4 }, () => crearProductoDirecto(db, categoriaId, { nombre })));
    const otra = (await db.categoria.create({ data: { nombre: unico("Otra") } })).id;
    await crearProductoDirecto(db, otra, { nombre });
    const archivado = await crearProductoDirecto(db, categoriaId, { nombre, activo: false });
    const ids = productos.map((fila) => fila.id).sort();
    for (const pagina of [1, 2]) {
      const respuesta = await lista(`q=${nombre}&categoriaId=${categoriaId}&porPagina=2&pagina=${pagina}`);
      expect(respuesta.total).toBe(4); expect(respuesta.pagina).toBe(pagina);
      expect(respuesta.datos.map((fila) => fila.id)).toEqual(ids.slice((pagina - 1) * 2, pagina * 2));
    }
    expect((await lista(`q=${nombre}&categoriaId=${categoriaId}&activo=false`)).datos.map((fila) => fila.id)).toEqual([archivado.id]);
  });
  it("rechaza filtros inválidos con 422", async () => {
    for (const consulta of ["pagina=0", "porPagina=101", "activo=otro", "categoriaId=abc"]) expect((await lista(consulta)).status).toBe(422);
  });
  it("dos recetas con la misma versión producen un ganador y un conflicto, en doce rondas", async () => {
    const [a, b] = await Promise.all([crearMaterial(db), crearMaterial(db)]);
    for (let ronda = 0; ronda < 12; ronda += 1) {
      const producto = await crearProductoDirecto(db, categoriaId);
      const respuestas = await Promise.all([receta(producto, a.id, "1"), receta(producto, b.id, "2")]);
      expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([200, 409]);
      expect(respuestas.find((respuesta) => respuesta.status === 409)?.error?.codigo).toBe("CONFLICTO_EDICION");
      const ganador = respuestas.find((respuesta) => respuesta.status === 200)?.datos;
      const guardado = await modulos.servicio.obtenerProducto(producto.id, operaciones.actor);
      expect(guardado.receta).toEqual(ganador?.receta);
      expect(guardado.actualizadoEn).toBe(ganador?.actualizadoEn);
      expect(await db.bitacora.count({ where: { entidad: "PRODUCTO", entidadId: producto.id, accion: "EDITAR" } })).toBe(1);
    }
  });
  it("edición frente a receta comparte la versión del producto", async () => {
    const producto = await crearProductoDirecto(db, categoriaId);
    const material = await crearMaterial(db);
    const respuestas = await Promise.all([
      receta(producto, material.id, "1"),
      invocar(modulos.ficha.PATCH, peticion("PATCH", "/", { cookie: operaciones.cookie,
        cuerpo: { version: producto.actualizadoEn.toISOString(), nombre: "Edición concurrente" } }), producto.id),
    ]);
    expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([200, 409]);
    expect(await db.bitacora.count({ where: { entidad: "PRODUCTO", entidadId: producto.id } })).toBe(1);
  });
  it("dos PATCH de producto y dos PATCH de categoría producen un ganador", async () => {
    const producto = await crearProductoDirecto(db, categoriaId);
    const categoria = await db.categoria.findUniqueOrThrow({ where: { id: categoriaId } });
    for (const [handler, registro] of [[modulos.ficha.PATCH, producto], [modulos.categoria.PATCH, categoria]] as const) {
      const respuestas = await Promise.all(["A", "B"].map((descripcion) => invocar(handler,
        peticion("PATCH", "/", { cookie: operaciones.cookie, cuerpo: { version: registro.actualizadoEn.toISOString(), descripcion } }), registro.id)));
      expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([200, 409]);
      expect(respuestas.find((respuesta) => respuesta.status === 409)?.error?.codigo).toBe("CONFLICTO_EDICION");
    }
  });
});
