import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import { hashearToken } from "@/lib/auth/tokens";
import { verificarContrasena } from "@/lib/auth/password";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import {
  CLAVE_PRUEBA, cargarAuth, crearUsuarioPrueba, iniciarSesionPrueba, liberarClienteGlobal,
  peticion, type ModulosAuth,
} from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

const CLAVE_NUEVA = "Clave-nueva-segura-456";
const RUTA = "/api/v1/auth/cambiar-clave";

describeConBase("cambio obligatorio de clave temporal", () => {
  const db = crearClientePropietario();
  let auth: ModulosAuth;
  let ruta: typeof import("@/app/api/v1/auth/cambiar-clave/route");
  let admin: typeof import("@/modules/admin/service");
  let servicio: typeof import("@/modules/auth/service");

  beforeAll(async () => {
    await sembrarReferencia(db);
    auth = await cargarAuth();
    ruta = await import("@/app/api/v1/auth/cambiar-clave/route");
    admin = await import("@/modules/admin/service");
    servicio = await import("@/modules/auth/service");
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  async function temporal(expiraEn = new Date(Date.now() + 48 * 3_600_000)) {
    const usuario = await crearUsuarioPrueba(db);
    return db.usuario.update({ where: { id: usuario.id },
      data: { contrasenaTemporal: true, contrasenaTemporalExpiraEn: expiraEn } });
  }

  function cambiar(cookie: string, claveActual = CLAVE_PRUEBA, claveNueva = CLAVE_NUEVA) {
    return ruta.POST(peticion("POST", RUTA, { cookie, cuerpo: { claveActual, claveNueva } }));
  }

  async function yo(cookie: string) {
    return auth.yo.GET(peticion("GET", "/api/v1/auth/yo", { cookie }));
  }

  it("crea y reinicia usuarios con clave temporal y vencimiento de 48 horas", async () => {
    const usuarioAdmin = await crearUsuarioPrueba(db, { perfil: "ADMIN" });
    const sesion = await servicio.iniciarSesion({ correo: usuarioAdmin.correo, contrasena: CLAVE_PRUEBA });
    const actor = { ...sesion.usuario, permisos: sesion.permisos };
    const inicio = Date.now();
    const creado = await admin.crearUsuario({ nombre: "Usuario temporal",
      correo: `temporal-${randomUUID()}@example.test`, perfiles: ["PRODUCCION"] }, actor);
    const fila = await db.usuario.findUniqueOrThrow({ where: { id: creado.usuario.id } });
    expect(fila.contrasenaTemporal).toBe(true);
    expect(fila.contrasenaTemporalExpiraEn!.getTime()).toBeGreaterThanOrEqual(inicio + 48 * 3_600_000);
    expect(fila.contrasenaTemporalExpiraEn!.getTime()).toBeLessThanOrEqual(Date.now() + 48 * 3_600_000);
    const { cookie } = await iniciarSesionPrueba(auth, fila.correo, creado.claveTemporal);
    expect((await cambiar(cookie, creado.claveTemporal)).status).toBe(200);
    const inicioReinicio = Date.now();
    const reinicio = await admin.reiniciarClaveUsuario(fila.id, actor);
    const nueva = await db.usuario.findUniqueOrThrow({ where: { id: fila.id } });
    expect(nueva.contrasenaTemporal).toBe(true);
    expect(nueva.contrasenaTemporalExpiraEn!.getTime()).toBeGreaterThanOrEqual(inicioReinicio + 48 * 3_600_000);
    expect(nueva.contrasenaTemporalExpiraEn!.getTime()).toBeLessThanOrEqual(Date.now() + 48 * 3_600_000);
    expect(await verificarContrasena(nueva.hashContrasena, reinicio.claveTemporal)).toBe(true);
    expect((await yo(cookie)).status).toBe(401);
  });

  it("rechaza la clave temporal vencida con el mismo error genérico", async () => {
    const usuario = await temporal(new Date(Date.now() - 1000));
    const vencida = await iniciarSesionPrueba(auth, usuario.correo);
    const inexistente = await iniciarSesionPrueba(auth, `ausente-${randomUUID()}@example.test`);
    expect(vencida.respuesta.status).toBe(401);
    expect(await vencida.respuesta.json()).toEqual(await inexistente.respuesta.json());
    expect(vencida.respuesta.headers.get("set-cookie")).toBeNull();
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0);
  });

  it("expone el cambio obligatorio en login y yo para una clave vigente", async () => {
    const usuario = await temporal();
    const { respuesta, cookie } = await iniciarSesionPrueba(auth, usuario.correo);
    expect(respuesta.status).toBe(200);
    expect((await respuesta.json()).datos.usuario.debeCambiarClave).toBe(true);
    expect((await (await yo(cookie)).json()).datos.usuario.debeCambiarClave).toBe(true);
  });

  it("bloquea la API de negocio mientras la clave sea temporal y la libera tras el cambio", async () => {
    const clientes = await import("@/app/api/v1/clientes/route");
    const usuario = await temporal();
    const { cookie } = await iniciarSesionPrueba(auth, usuario.correo);
    const bloqueada = await clientes.GET(peticion("GET", "/api/v1/clientes", { cookie }));
    expect(bloqueada.status).toBe(403);
    expect((await bloqueada.json()).error.codigo).toBe("CAMBIO_DE_CLAVE_REQUERIDO");
    expect((await yo(cookie)).status).toBe(200);
    expect((await cambiar(cookie)).status).toBe(200);
    const liberada = await clientes.GET(peticion("GET", "/api/v1/clientes", { cookie }));
    expect(liberada.status).not.toBe(403);
  });

  it("cambia el hash, elimina el vencimiento y revoca las demás sesiones", async () => {
    const usuario = await temporal();
    const actual = await iniciarSesionPrueba(auth, usuario.correo);
    const otra = await iniciarSesionPrueba(auth, usuario.correo);
    const ajeno = await crearUsuarioPrueba(db);
    const ajena = await iniciarSesionPrueba(auth, ajeno.correo);
    const respuesta = await cambiar(actual.cookie);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ datos: { debeCambiarClave: false } });
    const guardado = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(guardado.contrasenaTemporal).toBe(false);
    expect(guardado.contrasenaTemporalExpiraEn).toBeNull();
    expect(guardado.hashContrasena).toMatch(/^\$argon2id\$/);
    expect(await verificarContrasena(guardado.hashContrasena, CLAVE_NUEVA)).toBe(true);
    expect(await verificarContrasena(guardado.hashContrasena, CLAVE_PRUEBA)).toBe(false);
    const vigente = await db.sesion.findUniqueOrThrow({ where: { tokenHash: hashearToken(actual.cookie.split("=")[1]) } });
    expect(vigente.revocadaEn).toBeNull();
    expect(await db.sesion.count({ where: { usuarioId: usuario.id, revocadaEn: null } })).toBe(1);
    expect((await yo(otra.cookie)).status).toBe(401);
    expect((await yo(ajena.cookie)).status).toBe(200);
    expect((await (await yo(actual.cookie)).json()).datos.usuario.debeCambiarClave).toBe(false);
    const eventos = await db.bitacora.findMany({ where: { entidad: "USUARIO", entidadId: usuario.id, accion: "EDITAR" } });
    expect(eventos).toHaveLength(1);
    expect(eventos[0].usuarioId).toBe(usuario.id);
    expect(eventos[0].detalle).toEqual({ operacion: "CAMBIAR_CLAVE", sesionesRevocadas: true });
    for (const secreto of [CLAVE_PRUEBA, CLAVE_NUEVA, usuario.hashContrasena, guardado.hashContrasena]) {
      expect(JSON.stringify(eventos)).not.toContain(secreto);
    }
    expect((await iniciarSesionPrueba(auth, usuario.correo, CLAVE_NUEVA)).respuesta.status).toBe(200);
    expect((await iniciarSesionPrueba(auth, usuario.correo, CLAVE_PRUEBA)).respuesta.status).toBe(401);
  });

  it("rechaza la clave actual incorrecta sin cambiar usuario, sesiones ni bitácora", async () => {
    const usuario = await temporal();
    const actual = await iniciarSesionPrueba(auth, usuario.correo);
    const otra = await iniciarSesionPrueba(auth, usuario.correo);
    const antes = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    const respuesta = await cambiar(actual.cookie, "Clave-incorrecta-123");
    expect(respuesta.status).toBe(401);
    expect((await respuesta.json()).error.codigo).toBe("CREDENCIALES_INVALIDAS");
    expect(await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).toEqual(antes);
    expect(await db.sesion.count({ where: { usuarioId: usuario.id, revocadaEn: null } })).toBe(2);
    expect((await yo(otra.cookie)).status).toBe(200);
    expect(await db.bitacora.count({ where: { entidadId: usuario.id } })).toBe(0);
  });

  it.each(["corta", CLAVE_PRUEBA])("rechaza una clave débil o repetida: %s", async (claveNueva) => {
    const usuario = await temporal();
    const { cookie } = await iniciarSesionPrueba(auth, usuario.correo);
    const antes = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    const respuesta = await cambiar(cookie, CLAVE_PRUEBA, claveNueva);
    expect(respuesta.status).toBe(422);
    expect((await respuesta.json()).error.campos.claveNueva).toBeDefined();
    expect(await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).toEqual(antes);
    expect(await db.bitacora.count({ where: { entidadId: usuario.id } })).toBe(0);
  });

  it("exige sesión para cambiar la clave", async () => {
    expect((await cambiar("")).status).toBe(401);
  });
});
