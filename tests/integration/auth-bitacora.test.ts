import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import {
  CLAVE_PRUEBA, cargarAuth, crearUsuarioPrueba, iniciarSesionPrueba, liberarClienteGlobal,
  peticion, type ModulosAuth,
} from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

const CLAVE_NUEVA = "Clave-nueva-segura-456";

describeConBase("bitácora de seguridad de accesos", () => {
  const db = crearClientePropietario();
  let auth: ModulosAuth;
  let rutaClave: typeof import("@/app/api/v1/auth/cambiar-clave/route");
  let servicio: typeof import("@/modules/auth/service");

  beforeAll(async () => {
    await sembrarReferencia(db);
    auth = await cargarAuth();
    rutaClave = await import("@/app/api/v1/auth/cambiar-clave/route");
    servicio = await import("@/modules/auth/service");
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  function login(correo: string, contrasena = CLAVE_PRUEBA) {
    return auth.login.POST(peticion("POST", "/api/v1/auth/login", { cuerpo: { correo, contrasena } }));
  }

  async function eventos(usuarioId: string) {
    const filas = await db.bitacora.findMany({ where: { entidadId: usuarioId }, orderBy: { creadoEn: "asc" } });
    for (const fila of filas) {
      expect(fila.entidad).toBe("USUARIO");
      expect(fila.usuarioId).toBe(usuarioId);
      const detalle = JSON.stringify(fila.detalle);
      expect(detalle).not.toMatch(/contrasena|contraseña|token|hash|user-agent/i);
      expect(detalle).not.toContain(CLAVE_PRUEBA);
      expect(detalle).not.toContain(CLAVE_NUEVA);
    }
    return filas;
  }

  it("registra una fila por login correcto y descarta cabeceras sin proxy", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const req = peticion("POST", "/api/v1/auth/login", {
      cuerpo: { correo: usuario.correo, contrasena: CLAVE_PRUEBA },
    });
    req.headers.set("x-forwarded-for", "192.0.2.123");
    req.headers.set("user-agent", "agente-prueba-secreto");
    const respuesta = await auth.login.POST(req);
    expect(respuesta.status).toBe(200);
    const filas = await eventos(usuario.id);
    expect(filas).toHaveLength(1);
    expect(filas[0].accion).toBe("INICIAR_SESION");
    expect(filas[0].detalle).toEqual({ ip: "local" });
    expect(JSON.stringify(filas[0].detalle)).not.toContain(usuario.hashContrasena);
    expect(JSON.stringify(filas[0].detalle)).not.toContain("agente-prueba-secreto");
  });

  it("registra una fila por clave incorrecta", async () => {
    const usuario = await crearUsuarioPrueba(db);
    expect((await login(`  ${usuario.correo.toUpperCase()} `, "clave-incorrecta")).status).toBe(401);
    const filas = await eventos(usuario.id);
    expect(filas).toHaveLength(1);
    expect(filas[0].accion).toBe("INICIO_SESION_FALLIDO");
    expect(filas[0].detalle).toEqual({
      ip: "local", correoIntentado: usuario.correo, motivo: "CLAVE_INCORRECTA",
    });
    expect(JSON.stringify(filas[0].detalle)).not.toContain("clave-incorrecta");
  });

  it("registra BLOQUEAR_CUENTA solo en el quinto intento y omite intentos bloqueados", async () => {
    const usuario = await crearUsuarioPrueba(db);
    for (let intento = 1; intento <= 5; intento++) {
      expect((await login(usuario.correo, "clave-incorrecta")).status).toBe(intento === 5 ? 423 : 401);
      const filas = await eventos(usuario.id);
      expect(filas.filter((fila) => fila.accion === "INICIO_SESION_FALLIDO")).toHaveLength(intento);
      expect(filas.filter((fila) => fila.accion === "BLOQUEAR_CUENTA")).toHaveLength(intento === 5 ? 1 : 0);
      expect(filas).toHaveLength(intento === 5 ? 6 : intento);
    }
    const filas = await eventos(usuario.id);
    expect(filas.find((fila) => fila.accion === "BLOQUEAR_CUENTA")?.detalle).toEqual({
      ip: "local", correoIntentado: usuario.correo, minutos: 15,
    });
    expect((await login(usuario.correo)).status).toBe(423);
    expect((await login(usuario.correo, "clave-incorrecta")).status).toBe(423);
    expect(await eventos(usuario.id)).toHaveLength(6);
  });

  it("los fallos simultáneos registran cinco fallos y un solo bloqueo", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const entrada = { correo: usuario.correo, contrasena: "clave-incorrecta" };
    const respuestas = await Promise.allSettled(Array.from({ length: 8 }, () => servicio.iniciarSesion(entrada)));
    expect(respuestas.every((respuesta) => respuesta.status === "rejected")).toBe(true);
    const filas = await eventos(usuario.id);
    expect(filas).toHaveLength(6);
    expect(filas.filter((fila) => fila.accion === "INICIO_SESION_FALLIDO")).toHaveLength(5);
    expect(filas.filter((fila) => fila.accion === "BLOQUEAR_CUENTA")).toHaveLength(1);
  });

  it("registra un logout y omite el logout repetido y sin cookie", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const { cookie } = await iniciarSesionPrueba(auth, usuario.correo);
    const logout = (sesion: string) => auth.logout.POST(peticion("POST", "/api/v1/auth/logout", { cookie: sesion }));
    expect((await logout(cookie)).status).toBe(200);
    let filas = await eventos(usuario.id);
    expect(filas).toHaveLength(2);
    expect(filas.filter((fila) => fila.accion === "CERRAR_SESION")).toHaveLength(1);
    expect(filas.find((fila) => fila.accion === "CERRAR_SESION")?.detalle).toEqual({ ip: "local" });
    expect((await logout(cookie)).status).toBe(200);
    expect((await logout("")).status).toBe(200);
    filas = await eventos(usuario.id);
    expect(filas).toHaveLength(2);
    expect(await db.sesion.count({ where: { usuarioId: usuario.id, revocadaEn: null } })).toBe(0);
    expect(JSON.stringify(filas)).not.toContain(cookie.split("=")[1]);
  });

  it("registra CAMBIAR_CLAVE con revocación de otras sesiones", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const actual = await iniciarSesionPrueba(auth, usuario.correo);
    await iniciarSesionPrueba(auth, usuario.correo);
    const respuesta = await rutaClave.POST(peticion("POST", "/api/v1/auth/cambiar-clave", {
      cookie: actual.cookie, cuerpo: { claveActual: CLAVE_PRUEBA, claveNueva: CLAVE_NUEVA },
    }));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ datos: { debeCambiarClave: false } });
    const filas = await eventos(usuario.id);
    expect(filas).toHaveLength(3);
    expect(filas.filter((fila) => fila.accion === "CAMBIAR_CLAVE")).toHaveLength(1);
    expect(filas.find((fila) => fila.accion === "CAMBIAR_CLAVE")?.detalle).toEqual({
      ip: "local", sesionesRevocadas: true,
    });
    expect(await db.sesion.count({ where: { usuarioId: usuario.id, revocadaEn: null } })).toBe(1);
    const guardado = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    for (const secreto of [usuario.hashContrasena, guardado.hashContrasena, actual.cookie.split("=")[1]]) {
      expect(JSON.stringify(filas)).not.toContain(secreto);
    }
  });

  it("omite el correo inexistente y conserva la respuesta idéntica a una clave incorrecta", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const incorrecta = await login(usuario.correo, "clave-incorrecta");
    const antes = await db.bitacora.count();
    const inexistente = await login(`ausente-${randomUUID()}@example.test`, "clave-incorrecta");
    expect(incorrecta.status).toBe(401);
    expect(inexistente.status).toBe(incorrecta.status);
    expect(await inexistente.json()).toEqual(await incorrecta.json());
    expect(inexistente.headers.get("set-cookie")).toBeNull();
    expect(await db.bitacora.count()).toBe(antes);
    expect(await eventos(usuario.id)).toHaveLength(1);
  });

  it.each([CLAVE_PRUEBA, "clave-incorrecta"])("registra CUENTA_INACTIVA sin sumar intentos: %s", async (clave) => {
    const usuario = await crearUsuarioPrueba(db, { activo: false });
    expect((await login(usuario.correo, clave)).status).toBe(401);
    const filas = await eventos(usuario.id);
    expect(filas).toHaveLength(1);
    expect(filas[0].accion).toBe("INICIO_SESION_FALLIDO");
    expect(filas[0].detalle).toEqual({ ip: "local", correoIntentado: usuario.correo, motivo: "CUENTA_INACTIVA" });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).intentosFallidos).toBe(0);
  });

  it("registra SIN_PERFILES sin abrir sesión", async () => {
    const usuario = await crearUsuarioPrueba(db);
    await db.usuario.update({ where: { id: usuario.id }, data: { perfiles: { deleteMany: {} } } });
    expect((await login(usuario.correo)).status).toBe(401);
    const filas = await eventos(usuario.id);
    expect(filas).toHaveLength(1);
    expect(filas[0].accion).toBe("INICIO_SESION_FALLIDO");
    expect(filas[0].detalle).toEqual({ ip: "local", correoIntentado: usuario.correo, motivo: "SIN_PERFILES" });
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0);
  });

  it("registra CLAVE_TEMPORAL_VENCIDA sin abrir sesión", async () => {
    const usuario = await crearUsuarioPrueba(db);
    await db.usuario.update({ where: { id: usuario.id }, data: {
      contrasenaTemporal: true, contrasenaTemporalExpiraEn: new Date(Date.now() - 1000),
    } });
    expect((await login(usuario.correo)).status).toBe(401);
    const filas = await eventos(usuario.id);
    expect(filas).toHaveLength(1);
    expect(filas[0].accion).toBe("INICIO_SESION_FALLIDO");
    expect(filas[0].detalle).toEqual({ ip: "local", correoIntentado: usuario.correo, motivo: "CLAVE_TEMPORAL_VENCIDA" });
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0);
  });
});
