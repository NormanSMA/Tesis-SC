import { afterAll, beforeAll, expect, it } from "vitest";

import { can } from "@/core/autorizacion";
import type { PerfilCodigo } from "@/core/permisos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { abrirSesion, cargarModuloCatalogo, conPermisoRevocado, crearProductoDirecto, cuerpoProducto, invocar, unico, type ModuloCatalogo, type Sesion } from "./catalogo-ayudas";

const PERFILES: PerfilCodigo[] = ["GERENCIA", "VENTAS", "PRODUCCION", "ADMIN"];
const OPERACIONES = ["lista", "ficha", "crear", "editar", "archivar", "reactivar", "receta", "categorias", "crearCategoria", "editarCategoria", "materiales"] as const;
type Operacion = (typeof OPERACIONES)[number];
const LECTURAS: Operacion[] = ["lista", "ficha", "categorias", "materiales"];

describeConBase("catálogo: API por perfil y permisos revocados", () => {
  const db = crearClientePropietario();
  let modulos: ModuloCatalogo;
  let categoriaId: string;
  const sesiones = {} as Record<PerfilCodigo, Sesion>;
  beforeAll(async () => {
    await sembrarReferencia(db); modulos = await cargarModuloCatalogo();
    for (const perfil of PERFILES) sesiones[perfil] = await abrirSesion(db, modulos, perfil);
    categoriaId = (await db.categoria.create({ data: { nombre: unico("Categoría") } })).id;
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function ejecutar(operacion: Operacion, cookie?: string) {
    const producto = await crearProductoDirecto(db, categoriaId, { activo: operacion !== "reactivar" });
    const version = producto.actualizadoEn.toISOString();
    const categoria = await db.categoria.findUniqueOrThrow({ where: { id: categoriaId } });
    const rutas = {
      lista: { handler: modulos.productos.GET, metodo: "GET", ruta: "/api/v1/productos" },
      ficha: { handler: modulos.ficha.GET, metodo: "GET", ruta: `/api/v1/productos/${producto.id}`, id: producto.id },
      crear: { handler: modulos.productos.POST, metodo: "POST", ruta: "/api/v1/productos", cuerpo: cuerpoProducto(categoriaId) },
      editar: { handler: modulos.ficha.PATCH, metodo: "PATCH", ruta: `/api/v1/productos/${producto.id}`, id: producto.id, cuerpo: { version, descripcion: "Editada" } },
      archivar: { handler: modulos.archivar.POST, metodo: "POST", ruta: `/api/v1/productos/${producto.id}/archivar`, id: producto.id, cuerpo: { version } },
      reactivar: { handler: modulos.reactivar.POST, metodo: "POST", ruta: `/api/v1/productos/${producto.id}/reactivar`, id: producto.id, cuerpo: { version } },
      receta: { handler: modulos.receta.PUT, metodo: "PUT", ruta: `/api/v1/productos/${producto.id}/receta`, id: producto.id, cuerpo: { version, materiales: [] } },
      categorias: { handler: modulos.categorias.GET, metodo: "GET", ruta: "/api/v1/categorias" },
      crearCategoria: { handler: modulos.categorias.POST, metodo: "POST", ruta: "/api/v1/categorias", cuerpo: { nombre: unico("Categoría") } },
      editarCategoria: { handler: modulos.categoria.PATCH, metodo: "PATCH", ruta: `/api/v1/categorias/${categoriaId}`, id: categoriaId, cuerpo: { version: categoria.actualizadoEn.toISOString(), descripcion: unico() } },
      materiales: { handler: modulos.materiales.GET, metodo: "GET", ruta: "/api/v1/catalogo/materiales" },
    };
    const ruta = rutas[operacion];
    const respuesta = await invocar(ruta.handler, peticion(ruta.metodo, ruta.ruta, { cookie, cuerpo: "cuerpo" in ruta ? ruta.cuerpo : undefined }), "id" in ruta ? ruta.id : undefined);
    if (respuesta.status === 403 || respuesta.status === 401) {
      const guardado = await db.producto.findUniqueOrThrow({ where: { id: producto.id } });
      expect(guardado.actualizadoEn.toISOString()).toBe(version);
      expect(await db.bitacora.count({ where: { entidad: "PRODUCTO", entidadId: producto.id } })).toBe(0);
    }
    return respuesta;
  }
  for (const perfil of PERFILES) {
    for (const operacion of OPERACIONES) {
      const permitido = perfil === "GERENCIA" || (perfil !== "ADMIN" && LECTURAS.includes(operacion));
      const esperado = permitido ? ["crear", "crearCategoria"].includes(operacion) ? 201 : 200 : 403;
      it(`${perfil}: ${operacion} responde ${esperado}`, async () => {
        const respuesta = await ejecutar(operacion, sesiones[perfil].cookie);
        expect(respuesta.status).toBe(esperado);
        if (!permitido) expect(respuesta.error?.codigo).toBe("SIN_PERMISO");
      });
    }
  }
  it("sin sesión todas las rutas responden 401", async () => {
    for (const operacion of OPERACIONES) expect((await ejecutar(operacion)).status).toBe(401);
  });
  it("Origin ajeno rechaza cambios autorizados", async () => {
    const respuesta = await invocar(modulos.productos.POST, peticion("POST", "/api/v1/productos", {
      cookie: sesiones.GERENCIA.cookie, origen: "https://ajeno.example", cuerpo: cuerpoProducto(categoriaId),
    }));
    expect(respuesta.status).toBe(403); expect(respuesta.error?.codigo).toBe("ORIGEN_NO_PERMITIDO");
  });
  it("identificadores inválidos e inexistentes devuelven 404", async () => {
    for (const id of ["abc", "00000000-0000-4000-8000-000000000000"]) {
      expect((await invocar(modulos.ficha.GET, peticion("GET", "/", { cookie: sesiones.PRODUCCION.cookie }), id)).status).toBe(404);
    }
  });
  it.each(["GERENCIA", "VENTAS", "PRODUCCION"] as const)("revoca catalogo:ver para %s en la matriz y siempre lo restaura", async (perfil) => {
    await conPermisoRevocado(db, { perfil, permiso: "catalogo:ver" }, async () => {
      for (const operacion of ["lista", "ficha", "categorias"] as const) {
        expect((await ejecutar(operacion, sesiones[perfil].cookie)).status).toBe(403);
      }
      const actor = await modulos.auth.sesion.obtenerSesionDeRequest(peticion("GET", "/", { cookie: sesiones[perfil].cookie }));
      expect(actor && can(actor, "catalogo:ver")).toBe(false);
    });
    expect((await ejecutar("lista", sesiones[perfil].cookie)).status).toBe(200);
  });
  it("revoca catalogo:gestionar para Gerencia y siempre lo restaura", async () => {
    await conPermisoRevocado(db, { perfil: "GERENCIA", permiso: "catalogo:gestionar" }, async () => {
      for (const operacion of OPERACIONES.filter((operacion) => !LECTURAS.includes(operacion))) {
        expect((await ejecutar(operacion, sesiones.GERENCIA.cookie)).status).toBe(403);
      }
      const actor = await modulos.auth.sesion.obtenerSesionDeRequest(peticion("GET", "/", { cookie: sesiones.GERENCIA.cookie }));
      expect(actor && can(actor, "catalogo:gestionar")).toBe(false);
    });
    expect((await ejecutar("crear", sesiones.GERENCIA.cookie)).status).toBe(201);
  });
  it("materiales exige inventario:ver aunque se conserve catalogo:ver", async () => {
    await conPermisoRevocado(db, { perfil: "GERENCIA", permiso: "inventario:ver" }, async () => {
      expect((await ejecutar("materiales", sesiones.GERENCIA.cookie)).status).toBe(403);
      expect((await ejecutar("lista", sesiones.GERENCIA.cookie)).status).toBe(200);
    });
    expect((await ejecutar("materiales", sesiones.GERENCIA.cookie)).status).toBe(200);
  });
});
