import { createHash } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import {
  CLAVE_PRUEBA,
  cargarAuth,
  cookieDeRespuesta,
  crearUsuarioPrueba,
  iniciarSesionPrueba,
  liberarClienteGlobal,
  peticion,
  type ModulosAuth,
} from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

describeConBase("POST /api/v1/auth/login", () => {
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

  function login(correo: string, contrasena: string) {
    return auth.login.POST(peticion("POST", "/api/v1/auth/login", { cuerpo: { correo, contrasena } }));
  }

  it("con credenciales correctas devuelve usuario, permisos, destino y cookie de sesión", async () => {
    const usuario = await crearUsuarioPrueba(db, { perfil: "ATENCION_CLIENTE" });
    const respuesta = await login(usuario.correo, CLAVE_PRUEBA);
    expect(respuesta.status).toBe(200);
    const { datos } = await respuesta.json();
    expect(datos.usuario).toEqual({
      id: usuario.id, nombre: usuario.nombre, correo: usuario.correo,
      perfil: "ATENCION_CLIENTE", perfiles: ["ATENCION_CLIENTE"], debeCambiarClave: false,
    });
    expect(datos.destino).toBe("/panel");
    expect(datos.permisos).toContain("cotizacion:gestionar");
    expect(datos.permisos).not.toContain("usuario:gestionar");

    const cookie = respuesta.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^sc_sesion=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${12 * 3600}`);
    expect(cookie).not.toContain("Secure");
  });

  it("ADMIN va a la gestión de usuarios y no tiene panel:ver", async () => {
    const admin = await crearUsuarioPrueba(db, { perfil: "ADMIN" });
    const { datos } = await (await login(admin.correo, CLAVE_PRUEBA)).json();
    expect(datos.destino).toBe("/admin/usuarios");
    expect(datos.permisos).not.toContain("panel:ver");
  });

  it("acepta el correo con mayúsculas y espacios", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const respuesta = await login(`  ${usuario.correo.toUpperCase()} `, CLAVE_PRUEBA);
    expect(respuesta.status).toBe(200);
  });

  it("marca la cookie Secure cuando SESSION_COOKIE_SECURE es true", async () => {
    const usuario = await crearUsuarioPrueba(db);
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    const respuesta = await login(usuario.correo, CLAVE_PRUEBA);
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    expect(respuesta.headers.get("set-cookie")).toContain("; Secure");
  });

  it("guarda el SHA-256 del token y no el token", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const { cookie } = await iniciarSesionPrueba(auth, usuario.correo);
    const token = cookie.split("=")[1];
    const sesiones = await db.sesion.findMany({ where: { usuarioId: usuario.id } });
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(sesiones[0].tokenHash).not.toBe(token);
    const ttl = sesiones[0].expiraEn.getTime() - sesiones[0].creadoEn.getTime();
    expect(Math.abs(ttl - 12 * 3600_000)).toBeLessThan(5_000);
  });

  it("la contraseña se guarda con argon2id y los parámetros de OWASP", async () => {
    const usuario = await crearUsuarioPrueba(db);
    expect(usuario.hashContrasena.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
  });

  it("responde 422 con campos si el cuerpo no trae correo ni contraseña", async () => {
    const respuesta = await auth.login.POST(peticion("POST", "/api/v1/auth/login", { cuerpo: {} }));
    expect(respuesta.status).toBe(422);
    const { error } = await respuesta.json();
    expect(error.codigo).toBe("VALIDACION");
    expect(error.campos.correo).toBe("Ingrese su correo electrónico.");
    expect(error.campos.contrasena).toBe("Ingrese su contraseña.");
  });

  it("responde 422 con un correo mal formado", async () => {
    const respuesta = await login("no-es-correo", "x");
    expect(respuesta.status).toBe(422);
    expect((await respuesta.json()).error.campos.correo).toBe("Ingrese un correo electrónico válido.");
  });

  it("responde 400 si el cuerpo no es JSON", async () => {
    const solicitud = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: "{no es json",
    });
    const respuesta = await auth.login.POST(solicitud);
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.codigo).toBe("JSON_INVALIDO");
  });
});

describeConBase("login: credenciales inválidas y bloqueo", () => {
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

  function login(correo: string, contrasena: string) {
    return auth.login.POST(peticion("POST", "/api/v1/auth/login", { cuerpo: { correo, contrasena } }));
  }

  function leer(id: string) {
    return db.usuario.findUniqueOrThrow({ where: { id } });
  }

  it("clave errónea y usuario inexistente dan la misma respuesta 401", async () => {
    const usuario = await crearUsuarioPrueba(db);
    const clave = await login(usuario.correo, "otra-clave");
    const inexistente = await login("no-existe-xyz@example.com", "otra-clave");
    expect(clave.status).toBe(401);
    expect(inexistente.status).toBe(401);
    const cuerpoClave = await clave.json();
    expect(cuerpoClave).toEqual(await inexistente.json());
    expect(cuerpoClave).toEqual({
      error: { codigo: "CREDENCIALES_INVALIDAS", mensaje: "Correo o contraseña incorrectos" },
    });
    expect(clave.headers.get("set-cookie")).toBeNull();
  });

  it("un usuario inactivo no entra aunque la clave sea correcta y recibe el mismo 401", async () => {
    const inactivo = await crearUsuarioPrueba(db, { activo: false });
    const respuesta = await login(inactivo.correo, CLAVE_PRUEBA);
    expect(respuesta.status).toBe(401);
    expect((await respuesta.json()).error.mensaje).toBe("Correo o contraseña incorrectos");
    expect(await db.sesion.count({ where: { usuarioId: inactivo.id } })).toBe(0);
  });

  it("bloquea al quinto intento fallido con 423 y el instante de desbloqueo", async () => {
    const usuario = await crearUsuarioPrueba(db);
    for (let i = 1; i <= 4; i++) {
      expect((await login(usuario.correo, "mala")).status).toBe(401);
    }
    expect((await leer(usuario.id)).intentosFallidos).toBe(4);

    const quinto = await login(usuario.correo, "mala");
    expect(quinto.status).toBe(423);
    const { error } = await quinto.json();
    expect(error.codigo).toBe("CUENTA_BLOQUEADA");
    expect(error.mensaje).toContain("Intente de nuevo después del");

    const bloqueada = await leer(usuario.id);
    const minutos = ((bloqueada.bloqueadoHasta as Date).getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);
  });

  it("con la cuenta bloqueada rechaza incluso la clave correcta", async () => {
    const usuario = await crearUsuarioPrueba(db);
    await db.usuario.update({ where: { id: usuario.id }, data: { bloqueadoHasta: new Date(Date.now() + 10 * 60_000) } });
    expect((await login(usuario.correo, CLAVE_PRUEBA)).status).toBe(423);
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0);
  });

  it("al vencer el bloqueo permite entrar y reinicia el contador", async () => {
    const usuario = await crearUsuarioPrueba(db);
    await db.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 3, bloqueadoHasta: new Date(Date.now() - 1_000) },
    });
    expect((await login(usuario.correo, CLAVE_PRUEBA)).status).toBe(200);
    const actual = await leer(usuario.id);
    expect(actual.intentosFallidos).toBe(0);
    expect(actual.bloqueadoHasta).toBeNull();
    expect(actual.ultimoAcceso).not.toBeNull();
  });

  it("un acceso correcto reinicia el contador de fallos", async () => {
    const usuario = await crearUsuarioPrueba(db);
    await login(usuario.correo, "mala");
    await login(usuario.correo, "mala");
    expect((await leer(usuario.id)).intentosFallidos).toBe(2);
    expect((await login(usuario.correo, CLAVE_PRUEBA)).status).toBe(200);
    expect((await leer(usuario.id)).intentosFallidos).toBe(0);
    for (let i = 0; i < 4; i++) await login(usuario.correo, "mala");
    expect((await login(usuario.correo, CLAVE_PRUEBA)).status).toBe(200);
  });

  it("fallos simultáneos no se saltan el bloqueo", async () => {
    const usuario = await crearUsuarioPrueba(db);
    await Promise.all(Array.from({ length: 8 }, () => login(usuario.correo, "mala")));
    expect((await leer(usuario.id)).bloqueadoHasta).not.toBeNull();
    expect((await login(usuario.correo, CLAVE_PRUEBA)).status).toBe(423);
  });

  it("purga las sesiones vencidas del usuario al abrir una nueva", async () => {
    const usuario = await crearUsuarioPrueba(db);
    await db.sesion.create({
      data: {
        tokenHash: "a".repeat(32) + usuario.id.replaceAll("-", ""),
        usuarioId: usuario.id,
        creadoEn: new Date(Date.now() - 2 * 3600_000),
        expiraEn: new Date(Date.now() - 3600_000),
      },
    });
    const { respuesta } = await iniciarSesionPrueba(auth, usuario.correo);
    expect(cookieDeRespuesta(respuesta)).not.toBe("");
    expect(await db.sesion.count({ where: { usuarioId: usuario.id } })).toBe(1);
  });
});
