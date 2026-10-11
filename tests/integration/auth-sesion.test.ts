import { afterAll, beforeAll, expect, it } from "vitest";

import { PERMISOS_POR_PERFIL } from "@/core/permisos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import {
  cargarAuth,
  cookieDeRespuesta,
  crearUsuarioPrueba,
  iniciarSesionPrueba,
  liberarClienteGlobal,
  peticion,
  type ModulosAuth,
} from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

describeConBase("sesión: /yo, logout, expiración y revocación", () => {
  const db = crearClientePropietario();
  let auth: ModulosAuth;

  beforeAll(async () => {
    await sembrarReferencia(db);
    auth = await cargarAuth();
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  function yo(cookie?: string) {
    return auth.yo.GET(peticion("GET", "/api/v1/auth/yo", { cookie, origen: null }));
  }

  async function sesionDe(correo: string) {
    const { cookie } = await iniciarSesionPrueba(auth, correo);
    return cookie;
  }

  it("GET /yo sin cookie responde 401 SIN_SESION", async () => {
    const respuesta = await yo();
    expect(respuesta.status).toBe(401);
    expect((await respuesta.json()).error.codigo).toBe("SIN_SESION");
  });

  it("GET /yo con una cookie inventada responde 401", async () => {
    expect((await yo("sc_sesion=token-que-no-existe")).status).toBe(401);
  });

  it("GET /yo con cookie válida devuelve usuario y permisos", async () => {
    const usuario = await crearUsuarioPrueba(db, { perfil: "PRODUCCION" });
    const respuesta = await yo(await sesionDe(usuario.correo));
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos.usuario).toEqual({
      id: usuario.id, nombre: usuario.nombre, correo: usuario.correo,
      perfil: "PRODUCCION", perfiles: ["PRODUCCION"],
    });
    expect([...datos.permisos].sort()).toEqual([...PERMISOS_POR_PERFIL.PRODUCCION].sort());
    expect(datos.permisos).not.toContain("inventario:consumir");
    expect(datos.permisos).not.toContain("inventario:ajustar");
  });

  it("une dos perfiles y elige el perfil principal y destino según PERFILES", async () => {
    const usuario = await crearUsuarioPrueba(db, { perfil: "ADMIN", perfilesExtra: ["ADMINISTRACION"] });
    const { respuesta, cookie } = await iniciarSesionPrueba(auth, usuario.correo);
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos.usuario).toEqual({
      id: usuario.id, nombre: usuario.nombre, correo: usuario.correo,
      perfil: "ADMINISTRACION", perfiles: ["ADMINISTRACION", "ADMIN"],
    });
    const permisos = [...new Set([...PERMISOS_POR_PERFIL.ADMINISTRACION, ...PERMISOS_POR_PERFIL.ADMIN])].sort();
    expect([...datos.permisos].sort()).toEqual(permisos);
    expect(datos.destino).toBe("/panel");
    const consulta = await yo(cookie);
    expect(consulta.status).toBe(200);
    const sesion = (await consulta.json()).datos;
    expect(sesion.usuario).toEqual(datos.usuario);
    expect([...sesion.permisos].sort()).toEqual(permisos);
    const actor = await auth.sesion.obtenerSesionDeRequest(peticion("GET", "/", { cookie }));
    expect(actor).toMatchObject({ perfil: "ADMINISTRACION", perfiles: ["ADMINISTRACION", "ADMIN"] });
    expect([...(actor?.permisos ?? [])].sort()).toEqual(permisos);
  });

  it("rechaza una sesión expirada", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const cookie = await sesionDe(usuario.correo);
    expect((await yo(cookie)).status).toBe(200);
    await db.sesion.updateMany({
      where: { usuarioId: usuario.id },
      data: { creadoEn: new Date(Date.now() - 2 * 3600_000), expiraEn: new Date(Date.now() - 1_000) },
    });
    expect((await yo(cookie)).status).toBe(401);
  });

  it("rechaza una sesión revocada", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const cookie = await sesionDe(usuario.correo);
    await db.sesion.updateMany({ where: { usuarioId: usuario.id }, data: { revocadaEn: new Date() } });
    expect((await yo(cookie)).status).toBe(401);
  });

  it("rechaza la sesión de un usuario que se desactivó después de entrar", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const cookie = await sesionDe(usuario.correo);
    await db.usuario.update({ where: { id: usuario.id }, data: { activo: false } });
    expect((await yo(cookie)).status).toBe(401);
  });

  it("los permisos se leen de la base en cada petición, no del token", async () => {
    const usuario = await crearUsuarioPrueba(db, { perfil: "ATENCION_CLIENTE" });
    const cookie = await sesionDe(usuario.correo);
    const permiso = await db.permiso.findUniqueOrThrow({ where: { recurso_accion: { recurso: "reporte", accion: "ver" } } });
    const perfil = await db.perfil.findUniqueOrThrow({ where: { codigo: "ATENCION_CLIENTE" } });
    const clave = { perfilId_permisoId: { perfilId: perfil.id, permisoId: permiso.id } };

    await db.perfilPermiso.create({ data: { perfilId: perfil.id, permisoId: permiso.id } });
    try {
      expect((await (await yo(cookie)).json()).datos.permisos).toContain("reporte:ver");
    } finally {
      await db.perfilPermiso.delete({ where: clave });
    }
    expect((await (await yo(cookie)).json()).datos.permisos).not.toContain("reporte:ver");
  });

  it("logout revoca la sesión y borra la cookie", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const cookie = await sesionDe(usuario.correo);
    const respuesta = await auth.logout.POST(peticion("POST", "/api/v1/auth/logout", { cookie }));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ datos: { ok: true } });
    const borrada = respuesta.headers.get("set-cookie") ?? "";
    expect(borrada).toMatch(/^sc_sesion=;/);
    expect(borrada).toContain("Max-Age=0");
    expect(borrada).toContain("HttpOnly");

    const sesiones = await db.sesion.findMany({ where: { usuarioId: usuario.id } });
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].revocadaEn).not.toBeNull();
    expect((await yo(cookie)).status).toBe(401);
  });

  it("logout es idempotente: sin sesión o repetido también responde 200", async () => {
    const sinSesion = await auth.logout.POST(peticion("POST", "/api/v1/auth/logout"));
    expect(sinSesion.status).toBe(200);
    expect(cookieDeRespuesta(sinSesion)).toBe("sc_sesion=");

    const usuario = await crearUsuarioPrueba(db);
    const cookie = await sesionDe(usuario.correo);
    await auth.logout.POST(peticion("POST", "/api/v1/auth/logout", { cookie }));
    const repetido = await auth.logout.POST(peticion("POST", "/api/v1/auth/logout", { cookie }));
    expect(repetido.status).toBe(200);
  });

  it("logout de una sesión no afecta a otra del mismo usuario", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const primera = await sesionDe(usuario.correo);
    const segunda = await sesionDe(usuario.correo);
    await auth.logout.POST(peticion("POST", "/api/v1/auth/logout", { cookie: primera }));
    expect((await yo(primera)).status).toBe(401);
    expect((await yo(segunda)).status).toBe(200);
  });
});
