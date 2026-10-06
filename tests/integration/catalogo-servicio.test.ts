import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { CategoriaDto, FichaProducto, MaterialDto, ProductoDto } from "@/modules/catalogo/tipos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, cargarModuloCatalogo, crearMaterial, cuerpoProducto, invocar, unico, type ModuloCatalogo, type Sesion } from "./catalogo-ayudas";

describeConBase("catálogo: productos, recetas y categorías transaccionales", () => {
  const db = crearClientePropietario();
  let modulos: ModuloCatalogo;
  let gerencia: Sesion;
  let categoriaId: string;
  beforeAll(async () => {
    await sembrarReferencia(db);
    modulos = await cargarModuloCatalogo();
    gerencia = await abrirSesion(db, modulos, "GERENCIA");
    categoriaId = (await db.categoria.create({ data: { nombre: unico("Categoría") } })).id;
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  const crear = (extra: Record<string, unknown> = {}) => invocar(modulos.productos.POST,
    peticion("POST", "/api/v1/productos", { cookie: gerencia.cookie, cuerpo: cuerpoProducto(categoriaId, extra) }));
  const editar = (producto: ProductoDto, extra: Record<string, unknown>) => invocar(modulos.ficha.PATCH,
    peticion("PATCH", `/api/v1/productos/${producto.id}`, { cookie: gerencia.cookie, cuerpo: { version: producto.actualizadoEn, ...extra } }), producto.id);
  const estado = (producto: ProductoDto, accion: "archivar" | "reactivar", cuerpo: object = { version: producto.actualizadoEn }) =>
    invocar(modulos[accion].POST, peticion("POST", `/api/v1/productos/${producto.id}/${accion}`, { cookie: gerencia.cookie, cuerpo }), producto.id);
  const receta = (producto: ProductoDto, materiales: { materialId: string; cantidad: string }[]) => invocar<FichaProducto>(modulos.receta.PUT,
    peticion("PUT", `/api/v1/productos/${producto.id}/receta`, { cookie: gerencia.cookie, cuerpo: { version: producto.actualizadoEn, materiales } }), producto.id);
  const eventos = (id: string) => db.bitacora.findMany({ where: { entidad: "PRODUCTO", entidadId: id }, orderBy: [{ creadoEn: "asc" }, { id: "asc" }] });

  it("crea con 201, precio decimal y evento CREAR del actor", async () => {
    const respuesta = await crear({ precioBase: "1.50000", descripcion: " " });
    expect(respuesta.status).toBe(201);
    expect(respuesta.datos).toMatchObject({ precioBase: "1.50", descripcion: null, activo: true });
    expect(await eventos(respuesta.datos.id)).toMatchObject([{ accion: "CREAR", usuarioId: gerencia.actor.id, ordenId: null, cotizacionId: null }]);
  });
  it("edita solo campos enviados y registra anterior y nuevo", async () => {
    const { datos: producto } = await crear({ descripcion: "Antes" });
    const respuesta = await editar(producto, { descripcion: "", precioBase: "125" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.datos).toMatchObject({ nombre: producto.nombre, descripcion: null, precioBase: "125.00" });
    expect(new Date(respuesta.datos.actualizadoEn).getTime()).toBeGreaterThan(new Date(producto.actualizadoEn).getTime());
    expect((await eventos(producto.id))[1].detalle).toEqual({ cambios: {
      descripcion: { anterior: "Antes", nuevo: null }, precioBase: { anterior: "100.00", nuevo: "125.00" },
    } });
  });
  it("archiva, conserva receta, rechaza edición y reactiva con eventos", async () => {
    const { datos: producto } = await crear();
    const material = await crearMaterial(db);
    const conReceta = (await receta(producto, [{ materialId: material.id, cantidad: "1.2" }])).datos;
    const archivo = await estado(conReceta, "archivar");
    expect(archivo.status).toBe(200); expect(archivo.datos.activo).toBe(false);
    expect((await editar(archivo.datos, { nombre: "Ignorado" })).error?.codigo).toBe("PRODUCTO_ARCHIVADO");
    expect((await receta(archivo.datos, [])).status).toBe(409);
    const activo = await estado(archivo.datos, "reactivar");
    expect(activo.status).toBe(200); expect(activo.datos.activo).toBe(true);
    expect(await db.recetaProducto.count({ where: { productoId: producto.id } })).toBe(1);
    expect((await eventos(producto.id)).map((fila) => fila.accion)).toEqual(["CREAR", "EDITAR", "ARCHIVAR", "REACTIVAR"]);
  });
  it("rechaza códigos duplicados sin cambios ni eventos", async () => {
    const { datos: producto } = await crear();
    const antes = await db.bitacora.count({ where: { entidad: "PRODUCTO" } });
    const repetido = await crear({ codigo: producto.codigo });
    expect(repetido.status).toBe(409); expect(repetido.error?.codigo).toBe("DUPLICADO");
    expect(repetido.error?.campos?.codigo).toBeTruthy();
    const { datos: otro } = await crear();
    expect((await editar(otro, { codigo: producto.codigo })).status).toBe(409);
    expect((await db.producto.findUniqueOrThrow({ where: { id: otro.id } })).codigo).toBe(otro.codigo);
    expect(await db.bitacora.count({ where: { entidad: "PRODUCTO" } })).toBe(antes + 1);
  });
  it("rechaza referencias inexistentes sin guardar productos", async () => {
    const codigo = unico("P");
    expect((await crear({ codigo, categoriaId: randomUUID() })).status).toBe(409);
    expect(await db.producto.count({ where: { codigo } })).toBe(0);
  });
  it("sin versión devuelve 422 en PATCH, receta, archivo y reactivación", async () => {
    const { datos: producto } = await crear();
    expect((await editar(producto, { version: undefined })).status).toBe(422);
    for (const accion of ["archivar", "reactivar"] as const) expect((await estado(producto, accion, {})).status).toBe(422);
    expect((await invocar(modulos.receta.PUT, peticion("PUT", "/api/v1/productos/x/receta", {
      cookie: gerencia.cookie, cuerpo: { materiales: [] },
    }), producto.id)).status).toBe(422);
  });
  it("cuerpo vacío de escritura existente devuelve 422 y JSON inválido devuelve 400", async () => {
    const { datos: producto } = await crear();
    for (const [handler, metodo] of [[modulos.ficha.PATCH, "PATCH"], [modulos.receta.PUT, "PUT"], [modulos.archivar.POST, "POST"]] as const) {
      expect((await invocar(handler, peticion(metodo, "/", { cookie: gerencia.cookie }), producto.id)).status).toBe(422);
    }
    const solicitud = new Request("http://localhost/", { method: "PATCH", headers: { origin: "http://localhost", cookie: gerencia.cookie }, body: "{" });
    expect((await invocar(modulos.ficha.PATCH, solicitud, producto.id)).status).toBe(400);
  });
  it("versión vieja devuelve 409 CONFLICTO_EDICION en todas las escrituras del producto", async () => {
    const { datos: producto } = await crear();
    await editar(producto, { descripcion: "Actual" });
    for (const respuesta of [await editar(producto, { nombre: "Viejo" }), await estado(producto, "archivar"), await estado(producto, "reactivar"), await receta(producto, [])]) {
      expect(respuesta.status).toBe(409); expect(respuesta.error?.codigo).toBe("CONFLICTO_EDICION");
    }
  });
  it("una edición sin cambios conserva la versión y no registra EDITAR", async () => {
    const { datos: producto } = await crear();
    expect((await editar(producto, { nombre: producto.nombre, precioBase: "100.000" })).datos.actualizadoEn).toBe(producto.actualizadoEn);
    expect(await eventos(producto.id)).toHaveLength(1);
  });
  it("reemplaza y vacía recetas con detalle reconstruible y versión mayor", async () => {
    const { datos: producto } = await crear();
    const [a, b] = await Promise.all([crearMaterial(db), crearMaterial(db)]);
    const primero = await receta(producto, [{ materialId: a.id, cantidad: "1.25" }]);
    expect(primero.status).toBe(200);
    const segundo = await receta(primero.datos, [{ materialId: b.id, cantidad: "2.5" }]);
    expect(segundo.status).toBe(200);
    expect(segundo.datos.receta).toMatchObject([{ materialId: b.id, cantidad: "2.500" }]);
    expect((await eventos(producto.id))[2].detalle).toEqual({ cambios: { materiales: {
      anterior: [{ materialId: a.id, cantidad: "1.250" }], nuevo: [{ materialId: b.id, cantidad: "2.500" }],
    } } });
    expect(new Date(segundo.datos.actualizadoEn).getTime()).toBeGreaterThan(new Date(primero.datos.actualizadoEn).getTime());
    expect((await receta(segundo.datos, [])).datos.receta).toEqual([]);
  });
  it("rechaza material repetido, cantidad inválida e inexistente sin alterar receta ni versión", async () => {
    const { datos: producto } = await crear();
    const a = await crearMaterial(db);
    for (const materiales of [[{ materialId: a.id, cantidad: "0" }], [{ materialId: randomUUID(), cantidad: "1" }],
      [{ materialId: a.id, cantidad: "1" }, { materialId: a.id, cantidad: "2" }]]) {
      expect((await receta(producto, materiales)).status).toBe(422);
    }
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).actualizadoEn.toISOString()).toBe(producto.actualizadoEn);
    expect(await eventos(producto.id)).toHaveLength(1);
  });
  it("no ofrece material archivado nuevo y conserva material existente archivado", async () => {
    const { datos: producto } = await crear();
    const existente = await crearMaterial(db);
    const nuevo = await crearMaterial(db, false);
    const conReceta = (await receta(producto, [{ materialId: existente.id, cantidad: "1" }])).datos;
    await db.material.update({ where: { id: existente.id }, data: { activo: false } });
    expect((await receta(conReceta, [{ materialId: nuevo.id, cantidad: "1" }])).status).toBe(422);
    const conservado = await receta(conReceta, [{ materialId: existente.id, cantidad: "2" }]);
    expect(conservado.status).toBe(200); expect(conservado.datos.receta[0].material.activo).toBe(false);
    const activos = await invocar<MaterialDto[]>(modulos.materiales.GET, peticion("GET", "/api/v1/catalogo/materiales", { cookie: gerencia.cookie }));
    expect(activos.datos.some((material) => [existente.id, nuevo.id].includes(material.id))).toBe(false);
    const archivados = await invocar<MaterialDto[]>(modulos.materiales.GET, peticion("GET", `/api/v1/catalogo/materiales?activo=false&q=${nuevo.codigo}`, { cookie: gerencia.cookie }));
    expect(archivados.datos).toEqual([{ id: nuevo.id, codigo: nuevo.codigo, nombre: nuevo.nombre, unidad: "M2", activo: false, costoPromedio: "12.3456" }]);
  });
  it("revierte crear, editar, archivar, reactivar y receta si falla la bitácora", async () => {
    const fantasma = { ...gerencia.actor, id: randomUUID() };
    const cuerpo = cuerpoProducto(categoriaId);
    await expect(modulos.servicio.crearProducto(cuerpo, fantasma)).rejects.toThrow();
    expect(await db.producto.count({ where: { codigo: cuerpo.codigo } })).toBe(0);
    const { datos: producto } = await crear();
    const material = await crearMaterial(db);
    await expect(modulos.servicio.editarProducto(producto.id, { version: producto.actualizadoEn, nombre: "Ignorado" }, fantasma)).rejects.toThrow();
    await expect(modulos.recetas.reemplazarReceta(producto.id, { version: producto.actualizadoEn, materiales: [{ materialId: material.id, cantidad: "1" }] }, fantasma)).rejects.toThrow();
    await expect(modulos.servicio.archivarProducto(producto.id, producto.actualizadoEn, fantasma)).rejects.toThrow();
    const guardado = await db.producto.findUniqueOrThrow({ where: { id: producto.id }, include: { receta: true } });
    expect(guardado).toMatchObject({ nombre: producto.nombre, activo: true, receta: [] });
    expect(guardado.actualizadoEn.toISOString()).toBe(producto.actualizadoEn);
    const archivo = (await estado(producto, "archivar")).datos;
    await expect(modulos.servicio.reactivarProducto(archivo.id, archivo.actualizadoEn, fantasma)).rejects.toThrow();
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).activo).toBe(false);
    expect(await eventos(producto.id)).toHaveLength(2);
  });
  it("crea, edita, archiva y reactiva categorías con versión y bitácora", async () => {
    const crearCategoria = await invocar<CategoriaDto>(modulos.categorias.POST, peticion("POST", "/api/v1/categorias", { cookie: gerencia.cookie, cuerpo: { nombre: unico("Categoría") } }));
    expect(crearCategoria.status).toBe(201);
    let categoria = crearCategoria.datos;
    const primeraVersion = categoria.actualizadoEn;
    for (const cambios of [{ descripcion: "Nueva" }, { activo: false }, { activo: true }]) {
      const respuesta = await invocar<CategoriaDto>(modulos.categoria.PATCH, peticion("PATCH", "/", { cookie: gerencia.cookie, cuerpo: { version: categoria.actualizadoEn, ...cambios } }), categoria.id);
      expect(respuesta.status).toBe(200);
      expect(new Date(respuesta.datos.actualizadoEn).getTime()).toBeGreaterThan(new Date(categoria.actualizadoEn).getTime());
      categoria = respuesta.datos;
    }
    const eventosCategoria = await db.bitacora.findMany({ where: { entidad: "CATEGORIA", entidadId: categoria.id }, orderBy: { creadoEn: "asc" } });
    expect(eventosCategoria.map((fila) => fila.accion)).toEqual(["CREAR", "EDITAR", "ARCHIVAR", "REACTIVAR"]);
    expect(eventosCategoria[1].detalle).toEqual({ cambios: { descripcion: { anterior: null, nuevo: "Nueva" } } });
    expect((await invocar(modulos.categoria.PATCH, peticion("PATCH", "/", { cookie: gerencia.cookie, cuerpo: { version: primeraVersion, nombre: "Ignorado" } }), categoria.id)).error?.codigo).toBe("CONFLICTO_EDICION");
    expect((await invocar(modulos.categoria.PATCH, peticion("PATCH", "/", { cookie: gerencia.cookie, cuerpo: { nombre: "Ignorado" } }), categoria.id)).status).toBe(422);
  });
  it("rechaza categoría duplicada y revierte la categoría si falla su bitácora", async () => {
    const nombre = unico("Categoría");
    await modulos.servicioCategorias.crearCategoria({ nombre }, gerencia.actor);
    await expect(modulos.servicioCategorias.crearCategoria({ nombre }, gerencia.actor)).rejects.toMatchObject({ codigo: "DUPLICADO", status: 409 });
    const fantasma = { ...gerencia.actor, id: randomUUID() };
    const fallida = unico("Categoría");
    await expect(modulos.servicioCategorias.crearCategoria({ nombre: fallida }, fantasma)).rejects.toThrow();
    expect(await db.categoria.count({ where: { nombre: fallida } })).toBe(0);
    const categoria = await db.categoria.findUniqueOrThrow({ where: { nombre } });
    await expect(modulos.servicioCategorias.editarCategoria(categoria.id, { version: categoria.actualizadoEn.toISOString(), descripcion: "Ignorada" }, fantasma)).rejects.toThrow();
    expect((await db.categoria.findUniqueOrThrow({ where: { id: categoria.id } })).descripcion).toBeNull();
  });
});
