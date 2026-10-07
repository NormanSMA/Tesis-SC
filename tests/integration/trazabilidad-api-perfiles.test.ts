import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { liberarClienteGlobal, peticion } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { invocar } from "./ordenes-ayudas";
import { comprobarSinCliente, comprobarSinDinero, inyectarDetalle, libroConCostos,
  prepararTrazabilidad, type EntornoTrazabilidad } from "./trazabilidad-ayudas";

describeConBase("trazabilidad: API por perfil", () => {
  const db = crearClientePropietario();
  let entorno: EntornoTrazabilidad;
  let orden: Awaited<ReturnType<typeof libroConCostos>>["orden"];
  beforeAll(async () => {
    entorno = await prepararTrazabilidad(db); orden = (await libroConCostos(entorno)).orden;
    await inyectarDetalle(entorno, orden.id);
  });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  it.each(["GERENCIA", "ADMIN", "VENTAS", "PRODUCCION"] as const)("%s consulta global según la matriz", async (perfil) => {
    const respuesta = await invocar(entorno.rutas.global.GET, peticion("GET", `/api/v1/bitacora?orden=${orden.numero}`, { cookie: entorno.sesiones[perfil].cookie }));
    expect(respuesta.status).toBe(["GERENCIA", "ADMIN"].includes(perfil) ? 200 : 403);
    if (perfil === "ADMIN") { comprobarSinDinero(respuesta.datos); comprobarSinCliente(respuesta.datos); }
  });
  it.each(["GERENCIA", "ADMIN", "VENTAS", "PRODUCCION"] as const)("%s consulta trazabilidad según la matriz", async (perfil) => {
    const respuesta = await invocar(entorno.rutas.orden.GET, peticion("GET", `/api/v1/ordenes/${orden.id}/trazabilidad`, { cookie: entorno.sesiones[perfil].cookie }), orden.id);
    expect(respuesta.status).toBe(perfil === "ADMIN" ? 403 : 200);
    if (perfil === "PRODUCCION") { comprobarSinDinero(respuesta.cuerpo); comprobarSinCliente(respuesta.cuerpo); }
    if (["VENTAS", "GERENCIA"].includes(perfil)) expect(respuesta.datos).toHaveProperty("costoRealTotal");
  });
  it.each(["global", "orden"] as const)("%s responde 401 sin sesión", async (ruta) => {
    const respuesta = await invocar(entorno.rutas[ruta].GET, peticion("GET", "/api/v1/bitacora"), ruta === "orden" ? orden.id : undefined);
    expect(respuesta.status).toBe(401); expect(respuesta.error?.codigo).toBe("SIN_SESION");
  });
  it.each(["GERENCIA", "VENTAS", "PRODUCCION"] as const)("%s recibe 404 para orden inexistente", async (perfil) => {
    const id = randomUUID();
    const respuesta = await invocar(entorno.rutas.orden.GET, peticion("GET", `/api/v1/ordenes/${id}/trazabilidad`, { cookie: entorno.sesiones[perfil].cookie }), id);
    expect(respuesta.status).toBe(404); expect(respuesta.error?.codigo).toBe("NO_ENCONTRADO");
  });
  it.each(["GERENCIA", "VENTAS", "PRODUCCION"] as const)("%s recibe 422 para identificador inválido", async (perfil) => {
    const respuesta = await invocar(entorno.rutas.orden.GET, peticion("GET", "/api/v1/ordenes/invalido/trazabilidad", { cookie: entorno.sesiones[perfil].cookie }), "invalido");
    expect(respuesta.status).toBe(422); expect(respuesta.error?.codigo).toBe("VALIDACION");
  });
  it.each(["GERENCIA", "ADMIN"] as const)("%s recibe 422 para filtros inválidos", async (perfil) => {
    const respuesta = await invocar(entorno.rutas.global.GET, peticion("GET", "/api/v1/bitacora?pagina=0&entidad=OTRA&desde=2026-02-30", { cookie: entorno.sesiones[perfil].cookie }));
    expect(respuesta.status).toBe(422); expect(respuesta.error?.campos).toHaveProperty("pagina");
    expect(respuesta.error?.campos).toHaveProperty("desde");
  });
  it("rechaza perfiles sin permiso antes de validar identificadores o filtros", async () => {
    expect((await invocar(entorno.rutas.orden.GET, peticion("GET", "/api/v1/ordenes/invalido/trazabilidad", { cookie: entorno.sesiones.ADMIN.cookie }), "invalido")).status).toBe(403);
    expect((await invocar(entorno.rutas.global.GET, peticion("GET", "/api/v1/bitacora?pagina=0", { cookie: entorno.sesiones.VENTAS.cookie }))).status).toBe(403);
  });
});
