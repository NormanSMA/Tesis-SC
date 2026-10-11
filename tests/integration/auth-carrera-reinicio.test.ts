import { afterAll, beforeAll, expect, it } from "vitest";

import { verificarContrasena } from "@/lib/auth/password";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import { CLAVE_PRUEBA, cargarAuth, crearUsuarioPrueba, liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

describeConBase("login: carrera contra cambios del usuario", () => {
  const db = crearClientePropietario();
  let auth: typeof import("@/modules/auth/service");
  let admin: typeof import("@/modules/admin/service");
  let actor: Awaited<ReturnType<typeof crearAdmin>>;

  async function crearAdmin() {
    const usuario = await crearUsuarioPrueba(db, { perfil: "ADMIN" });
    const sesion = await auth.iniciarSesion({ correo: usuario.correo, contrasena: CLAVE_PRUEBA });
    return { ...sesion.usuario, permisos: sesion.permisos };
  }

  async function leerVerificado(id: string) {
    const usuario = await db.usuario.findUniqueOrThrow({
      where: { id },
      include: { perfiles: { include: { perfil: { include: { permisos: { include: { permiso: true } } } } } } },
    });
    expect(await verificarContrasena(usuario.hashContrasena, CLAVE_PRUEBA)).toBe(true);
    return usuario;
  }

  const errorCredenciales = {
    status: 401,
    codigo: "CREDENCIALES_INVALIDAS",
    mensaje: "Correo o contraseña incorrectos",
  };

  beforeAll(async () => {
    await sembrarReferencia(db);
    await cargarAuth();
    auth = await import("@/modules/auth/service");
    admin = await import("@/modules/admin/service");
    actor = await crearAdmin();
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  it("rechaza el hash verificado si ADMIN reinicia la clave antes de abrir la sesión", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const verificado = await leerVerificado(usuario.id);
    const reinicio = await admin.reiniciarClaveUsuario(usuario.id, actor);

    await expect(auth.abrirSesion(verificado, new Date())).rejects.toMatchObject(errorCredenciales);

    const actual = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(actual.hashContrasena).not.toBe(verificado.hashContrasena);
    expect(actual.ultimoAcceso).toBeNull();
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0);

    const sesion = await auth.iniciarSesion({ correo: usuario.correo, contrasena: reinicio.claveTemporal });
    expect(sesion.usuario.id).toBe(usuario.id);
    expect(await db.sesion.count({ where: { usuarioId: usuario.id, revocadaEn: null } })).toBe(1);
  });

  it("rechaza la apertura si ADMIN desactiva al usuario después de verificar la clave", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const verificado = await leerVerificado(usuario.id);
    await admin.desactivarUsuario(usuario.id, actor);

    await expect(auth.abrirSesion(verificado, new Date())).rejects.toMatchObject(errorCredenciales);

    const actual = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(actual.activo).toBe(false);
    expect(actual.ultimoAcceso).toBeNull();
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0);
  });

  it("conserva el bloqueo impuesto después de verificar la clave y responde con error genérico", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const verificado = await leerVerificado(usuario.id);
    const ahora = new Date();
    const bloqueadoHasta = new Date(ahora.getTime() + 60_000);
    await db.usuario.update({ where: { id: usuario.id }, data: { bloqueadoHasta, intentosFallidos: 4 } });

    await expect(auth.abrirSesion(verificado, ahora)).rejects.toMatchObject(errorCredenciales);

    const actual = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(actual.bloqueadoHasta).toEqual(bloqueadoHasta);
    expect(actual.intentosFallidos).toBe(4);
    expect(actual.ultimoAcceso).toBeNull();
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0);
  });

  it("abre la sesión con el mismo hash y un bloqueo vencido sin perder el reinicio del contador", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const ahora = new Date();
    await db.usuario.update({
      where: { id: usuario.id }, data: { intentosFallidos: 3, bloqueadoHasta: ahora },
    });
    const verificado = await leerVerificado(usuario.id);

    const sesion = await auth.abrirSesion(verificado, ahora);

    expect(sesion.usuario.id).toBe(usuario.id);
    const actual = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(actual.intentosFallidos).toBe(0);
    expect(actual.bloqueadoHasta).toBeNull();
    expect(actual.ultimoAcceso).toEqual(ahora);
    expect(await db.sesion.count({ where: { usuarioId: usuario.id, revocadaEn: null } })).toBe(1);
  });
});
