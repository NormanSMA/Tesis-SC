import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { abrirSesion, prepararCotizaciones, type EntornoCotizaciones } from "./cotizaciones-ayudas";
import { invocar } from "../helpers/fabricas";
import { esquemaGuardar } from "@/modules/personalizadas/schema";

describeConBase("personalizadas: configuración autorizada y versionada", () => {
  const db = crearClientePropietario();
  let entorno: EntornoCotizaciones;
  let servicio: typeof import("@/modules/personalizadas/service");
  let ruta: typeof import("@/app/api/v1/personalizadas/route");
  beforeAll(async () => { entorno = await prepararCotizaciones(db); servicio = await import("@/modules/personalizadas/service"); ruta = await import("@/app/api/v1/personalizadas/route"); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });
  it("Administración agrega una categoría y tipo sin existencias ni precios; Operaciones puede consultar pero no configurar", async () => {
    const admin = await abrirSesion(db, entorno.modulos, "ADMINISTRACION");
    const ops = await abrirSesion(db, entorno.modulos, "OPERACIONES");
    const material = await db.material.findFirstOrThrow({ where: { activo: true } });
    const antes = await db.material.findUniqueOrThrow({ where: { id: material.id } });
    const entrada = esquemaGuardar.parse({ version: null, categorias: [{ id: randomUUID(), nombre: "Rotulación configurable " + randomUUID().slice(0,8),
      tipos: [{ id: randomUUID(), nombre: "Rótulo luminoso", unidadCobro: "UNIDAD", margenPct: "30", materiales: [material.id] }] }] });
    expect((await invocar(ruta.PUT, peticion("PUT", "/api/v1/personalizadas", { cookie: ops.cookie, cuerpo: entrada }))).status).toBe(403);
    const guardado = await servicio.guardarPersonalizadas(entrada, admin.actor);
    expect((await servicio.leerPersonalizadas()).categorias).toEqual(guardado.categorias);
    expect((await invocar(ruta.GET, peticion("GET", "/api/v1/personalizadas", { cookie: ops.cookie }))).status).toBe(200);
    expect(await db.material.findUniqueOrThrow({ where: { id: material.id } })).toEqual(antes);
    const fila = await db.configuracion.findUniqueOrThrow({ where: { clave: servicio.CLAVE_PERSONALIZADAS } });
    expect(await db.bitacora.count({ where: { entidadId: fila.id, accion: "CREAR" } })).toBe(1);
    await expect(servicio.guardarPersonalizadas(entrada, admin.actor)).rejects.toMatchObject({ status: 409 });
    const invalida = { ...guardado, categorias: guardado.categorias.map(c => ({ ...c, tipos: c.tipos.map(t => ({ ...t, materiales: [randomUUID()] })) })) };
    await expect(servicio.guardarPersonalizadas(invalida, admin.actor)).rejects.toMatchObject({ status: 422 });
    expect(await servicio.leerPersonalizadas()).toEqual(guardado);
    const vacio = await servicio.guardarPersonalizadas({ version: guardado.version, categorias: [] }, admin.actor);
    expect(vacio.categorias).toEqual([]);
    expect(await db.categoria.findUnique({ where: { id: guardado.categorias[0].id } })).not.toBeNull();
  });
  it("rechaza margen 100, tipos duplicados y materiales repetidos", () => {
    const tipo = { id: randomUUID(), nombre: "Prueba", unidadCobro: "UNIDAD", margenPct: "100", materiales: [] };
    const base = { version: null, categorias: [{ id: randomUUID(), nombre: "Rotulación", tipos: [tipo] }] };
    expect(esquemaGuardar.safeParse(base).success).toBe(false);
    tipo.margenPct = "30";base.categorias[0].tipos.push({ ...tipo });
    expect(esquemaGuardar.safeParse(base).success).toBe(false);
  });
});
