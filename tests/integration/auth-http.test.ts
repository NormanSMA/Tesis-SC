import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { z } from "zod";

import type { PerfilCodigo } from "@/core/permisos";

import { sembrarReferencia } from "../../prisma/seed/referencia";
import {
  cargarAuth,
  crearUsuarioPrueba,
  iniciarSesionPrueba,
  liberarClienteGlobal,
  peticion,
  type ModulosAuth,
} from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";

describeConBase("manejar: sesión, permiso, origen y validación", () => {
  const db = crearClientePropietario();
  let auth: ModulosAuth;
  let leerClientes: (req: Request) => Promise<Response>;
  let crearCliente: (req: Request) => Promise<Response>;
  let publica: (req: Request) => Promise<Response>;
  let conParametro: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    await sembrarReferencia(db);
    auth = await cargarAuth();
    const { manejar, ok, leerJson } = auth.http;
    leerClientes = manejar({ permiso: "cliente:ver" }, ({ actor }) => ok({ actor: actor.id }));
    crearCliente = manejar({ permiso: "cliente:gestionar" }, async ({ req }) => {
      const cuerpo = await leerJson(req, z.object({ nombre: z.string({ error: "Falta el nombre." }).min(1, "Falta el nombre.") }));
      return ok(cuerpo, 201);
    });
    publica = manejar({ publica: true }, ({ actor }) => ok({ actor }));
    conParametro = manejar({}, async ({ params }) => ok({ id: params.id }));
  });

  afterEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  afterAll(async () => {
    await liberarClienteGlobal();
    await db.$disconnect();
  });

  async function cookieDe(perfil: PerfilCodigo) {
    const usuario = await crearUsuarioPrueba(db, { perfil });
    return { usuario, cookie: (await iniciarSesionPrueba(auth, usuario.correo)).cookie };
  }

  it("responde 401 sin sesión", async () => {
    const respuesta = await leerClientes(peticion("GET", "/api/v1/clientes", { origen: null }));
    expect(respuesta.status).toBe(401);
    expect((await respuesta.json()).error.codigo).toBe("SIN_SESION");
  });

  it("responde 403 con sesión pero sin el permiso", async () => {
    const { cookie } = await cookieDe("ADMIN");
    const respuesta = await leerClientes(peticion("GET", "/api/v1/clientes", { cookie, origen: null }));
    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).error.codigo).toBe("SIN_PERMISO");
  });

  it.each([
    ["GERENCIA", 200, 403], ["ADMINISTRACION", 403, 403], ["OPERACIONES", 200, 403],
    ["ATENCION_CLIENTE", 200, 201], ["PRODUCCION", 403, 403], ["ADMIN", 403, 403],
  ] as const)("%s consulta y gestiona clientes según la matriz", async (perfil, lectura, escritura) => {
    const { cookie } = await cookieDe(perfil);
    expect((await leerClientes(peticion("GET", "/api/v1/clientes", { cookie, origen: null }))).status).toBe(lectura);
    expect((await crearCliente(peticion("POST", "/api/v1/clientes", { cookie, cuerpo: { nombre: "X" } }))).status).toBe(escritura);
  });

  it("responde 200 con el permiso y entrega el actor al handler", async () => {
    const { usuario, cookie } = await cookieDe("ATENCION_CLIENTE");
    const respuesta = await leerClientes(peticion("GET", "/api/v1/clientes", { cookie, origen: null }));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ datos: { actor: usuario.id } });
  });

  it("el permiso se decide por acción: Gerencia ve clientes pero no los gestiona", async () => {
    const { cookie } = await cookieDe("GERENCIA");
    expect((await leerClientes(peticion("GET", "/api/v1/clientes", { cookie, origen: null }))).status).toBe(200);
    const respuesta = await crearCliente(peticion("POST", "/api/v1/clientes", { cookie, cuerpo: { nombre: "X" } }));
    expect(respuesta.status).toBe(403);
  });

  it("rechaza con 403 ORIGEN_NO_PERMITIDO un POST con Origin ajeno, aun con sesión y permiso", async () => {
    const { cookie } = await cookieDe("ATENCION_CLIENTE");
    const respuesta = await crearCliente(
      peticion("POST", "/api/v1/clientes", { cookie, cuerpo: { nombre: "X" }, origen: "https://sitio-malicioso.example" }),
    );
    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).error.codigo).toBe("ORIGEN_NO_PERMITIDO");
  });

  it("rechaza un Origin ilegible como el literal null", async () => {
    const respuesta = await publica(peticion("POST", "/api/v1/x", { origen: "null" }));
    expect(respuesta.status).toBe(403);
  });

  it("la comprobación de Origin cubre también las rutas públicas", async () => {
    const respuesta = await auth.login.POST(
      peticion("POST", "/api/v1/auth/login", {
        cuerpo: { correo: "a@example.com", contrasena: "x" },
        origen: "https://sitio-malicioso.example",
      }),
    );
    expect(respuesta.status).toBe(403);
  });

  it("sin Origin acepta el POST solo cuando NODE_ENV es test", async () => {
    const { cookie } = await cookieDe("ATENCION_CLIENTE");
    const solicitud = () => peticion("POST", "/api/v1/clientes", { cookie, cuerpo: { nombre: "X" }, origen: null });
    expect((await crearCliente(solicitud())).status).toBe(201);
    vi.stubEnv("NODE_ENV", "production");
    const rechazada = await crearCliente(solicitud());
    expect(rechazada.status).toBe(403);
    expect((await rechazada.json()).error.codigo).toBe("ORIGEN_NO_PERMITIDO");
  });

  it("los métodos de lectura no exigen Origin", async () => {
    const { cookie } = await cookieDe("ATENCION_CLIENTE");
    vi.stubEnv("NODE_ENV", "production");
    const respuesta = await leerClientes(peticion("GET", "/api/v1/clientes", { cookie, origen: null }));
    expect(respuesta.status).toBe(200);
  });

  it("una ruta pública no carga la sesión", async () => {
    const respuesta = await publica(peticion("POST", "/api/v1/x"));
    expect(await respuesta.json()).toEqual({ datos: { actor: null } });
  });

  it("leerJson responde 422 con un campo por error", async () => {
    const { cookie } = await cookieDe("ATENCION_CLIENTE");
    const respuesta = await crearCliente(peticion("POST", "/api/v1/clientes", { cookie, cuerpo: {} }));
    expect(respuesta.status).toBe(422);
    expect(await respuesta.json()).toEqual({
      error: { codigo: "VALIDACION", mensaje: "Hay campos con errores.", campos: { nombre: "Falta el nombre." } },
    });
  });

  it("entrega los parámetros de la ruta ya resueltos", async () => {
    const { cookie } = await cookieDe("ATENCION_CLIENTE");
    const respuesta = await conParametro(peticion("GET", "/api/v1/clientes/7", { cookie, origen: null }), {
      params: Promise.resolve({ id: "7" }),
    });
    expect(await respuesta.json()).toEqual({ datos: { id: "7" } });
  });

  it("convierte una excepción inesperada en 500 sin filtrar el detalle", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rota = auth.http.manejar({ publica: true }, () => {
      throw new Error("detalle interno secreto");
    });
    const respuesta = await rota(peticion("GET", "/api/v1/x", { origen: null }));
    espia.mockRestore();
    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(await respuesta.json())).not.toContain("secreto");
  });
});
