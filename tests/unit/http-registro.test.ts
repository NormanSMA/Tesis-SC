import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { obtenerSesionDeRequest } from "@/lib/auth/sesion";
import { AppError } from "@/lib/errores";
import { manejar, ok } from "@/lib/http";

vi.mock("@/lib/auth/sesion", () => ({ obtenerSesionDeRequest: vi.fn() }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function peticion() {
  return new Request("https://sc.test/api/v1/clientes?token=secreto#clave", {
    method: "POST",
    headers: {
      origin: "https://sc.test",
      authorization: "Bearer secreto",
      cookie: "sesion=secreto",
      "x-api-key": "clave-secreta",
      "x-request-id": "token-secreto",
      "content-type": "application/json",
    },
    body: JSON.stringify({ contrasena: "secreto", cliente: "dato-sensible" }),
  });
}

async function provocarError(error: unknown) {
  return manejar({ publica: true }, () => { throw error; })(peticion());
}

describe("registro de errores HTTP", () => {
  it("escribe solamente los cinco campos permitidos", async () => {
    const error = Object.assign(new Error("Bearer secreto; contrasena=secreto"), {
      headers: { authorization: "Bearer secreto" },
      cookies: { sesion: "secreto" },
      token: "secreto",
      apiKey: "clave-secreta",
      body: { cliente: "dato-sensible" },
      cause: new Error("postgresql://usuario:clave@servidor/base"),
    });
    const respuesta = await provocarError(error);
    expect(respuesta.status).toBe(500);
    expect(await respuesta.json()).toEqual({
      error: { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" },
    });
    expect(console.error).toHaveBeenCalledExactlyOnceWith({
      codigo: "ERROR_INTERNO",
      mensaje: "Error interno del servidor",
      ruta: "/api/v1/clientes",
      metodo: "POST",
      peticionId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/secreto|clave|dato-sensible/);
  });

  it("omite campos y propiedades adicionales de errores controlados", async () => {
    const error = Object.assign(new AppError({
      codigo: "SERVICIO_NO_DISPONIBLE",
      mensaje: "Servicio no disponible.",
      status: 503,
      campos: { contrasena: "secreto" },
    }), { token: "secreto", cuerpo: { clave: "secreto" } });
    const respuesta = await provocarError(error);
    expect(respuesta.status).toBe(503);
    expect(console.error).toHaveBeenCalledExactlyOnceWith({
      codigo: "SERVICIO_NO_DISPONIBLE",
      mensaje: "Servicio no disponible.",
      ruta: "/api/v1/clientes",
      metodo: "POST",
      peticionId: expect.any(String),
    });
  });

  it.each([null, "token=secreto", { token: "secreto", mensaje: "dato-sensible" }])(
    "filtra errores de cualquier forma: %s",
    async (error) => {
      await provocarError(error);
      expect(console.error).toHaveBeenCalledExactlyOnceWith({
        codigo: "ERROR_INTERNO",
        mensaje: "Error interno del servidor",
        ruta: "/api/v1/clientes",
        metodo: "POST",
        peticionId: expect.any(String),
      });
    },
  );

  it("genera identificadores distintos sin aceptar identificadores de cabeceras", async () => {
    await provocarError(new Error("secreto"));
    await provocarError(new Error("secreto"));
    const llamadas = vi.mocked(console.error).mock.calls;
    expect(llamadas[0][0].peticionId).not.toBe(llamadas[1][0].peticionId);
    expect(llamadas[0][0].peticionId).not.toBe("token-secreto");
  });

  it("filtra errores durante la carga de sesión", async () => {
    vi.mocked(obtenerSesionDeRequest).mockRejectedValueOnce(new Error("cookie=secreto"));
    const respuesta = await manejar({}, () => ok(null))(peticion());
    expect(respuesta.status).toBe(500);
    expect(console.error).toHaveBeenCalledExactlyOnceWith({
      codigo: "ERROR_INTERNO",
      mensaje: "Error interno del servidor",
      ruta: "/api/v1/clientes",
      metodo: "POST",
      peticionId: expect.any(String),
    });
  });

  it("conserva respuestas 4xx sin agregar registros", async () => {
    const respuesta = await provocarError(new AppError({
      codigo: "VALIDACION", mensaje: "Hay campos con errores.", status: 422,
      campos: { nombre: "Requerido" },
    }));
    expect(respuesta.status).toBe(422);
    expect(await respuesta.json()).toEqual({
      error: { codigo: "VALIDACION", mensaje: "Hay campos con errores.", campos: { nombre: "Requerido" } },
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("conserva respuestas exitosas sin agregar registros", async () => {
    const respuesta = await manejar({ publica: true }, () => ok({ id: "cliente" }))(peticion());
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ datos: { id: "cliente" } });
    expect(console.error).not.toHaveBeenCalled();
  });
});
