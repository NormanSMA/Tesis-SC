import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";

import { solicitarApi } from "@/lib/cliente-api";
import { enviarApi } from "@/modules/catalogo/api";

const peticion = { url: "/api/v1/prueba", metodo: "POST", cuerpo: { nombre: "Prueba" } };
const esquema = z.object({ id: z.string() });

afterEach(() => vi.unstubAllGlobals());

function responder(cuerpo: unknown, status = 200) {
  const fetch = vi.fn().mockResolvedValue(Response.json(cuerpo, { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("solicitarApi", () => {
  it("valida la respuesta correcta y conserva el transporte JSON", async () => {
    const fetch = responder({ datos: { id: "registro-1" } });
    const resultado = await solicitarApi({ ...peticion, esquema });
    expect(resultado).toEqual({ datos: { id: "registro-1" } });
    if ("datos" in resultado) expectTypeOf(resultado.datos).toEqualTypeOf<{ id: string }>();
    expect(fetch).toHaveBeenCalledExactlyOnceWith(peticion.url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(peticion.cuerpo),
    });
  });

  it("devuelve datos desconocidos cuando no recibe un esquema", async () => {
    responder({ datos: { id: "registro-1", activo: true } });
    const resultado = await solicitarApi(peticion);
    expect(resultado).toEqual({ datos: { id: "registro-1", activo: true } });
    if ("datos" in resultado) expectTypeOf(resultado.datos).toEqualTypeOf<unknown>();
  });

  it("conserva codigo, mensaje y campos del error", async () => {
    const error = { codigo: "ORDEN_EXISTENTE", mensaje: "La orden ya existe.",
      campos: { ordenId: "orden-1", numero: "OT-001" } };
    responder({ error }, 409);
    expect(await solicitarApi({ ...peticion, esquema })).toEqual({ error });
  });

  it("traduce el error sin JSON al mensaje existente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Servicio no disponible", { status: 503 })));
    expect(await solicitarApi(peticion)).toEqual({ error: { mensaje: "No se pudo guardar." } });
  });

  it("rechaza una respuesta que no cumple el esquema", async () => {
    responder({ datos: { id: 17 } });
    expect(await solicitarApi({ ...peticion, esquema })).toEqual({ error: { mensaje: "No se pudo guardar." } });
  });

  it("devuelve los datos transformados por el esquema", async () => {
    responder({ datos: { id: " registro-1 " } });
    expect(await solicitarApi({ ...peticion, esquema: z.object({ id: z.string().trim() }) }))
      .toEqual({ datos: { id: "registro-1" } });
  });

  it.each([null, [], {}, { datos: null }])("rechaza el cuerpo sin datos: %j", async (cuerpo) => {
    responder(cuerpo);
    expect(await solicitarApi(peticion)).toEqual({ error: { mensaje: "No se pudo guardar." } });
  });

  it("rechaza datos de exito cuando el estado HTTP indica un error", async () => {
    responder({ datos: { id: "registro-1" } }, 500);
    expect(await solicitarApi({ ...peticion, esquema })).toEqual({ error: { mensaje: "No se pudo guardar." } });
  });

  it("conserva el mensaje de conexion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await solicitarApi(peticion)).toEqual({
      error: { mensaje: "No se pudo conectar. Revise su conexión e intente nuevamente." },
    });
  });

  it("normaliza un error que no cumple el contrato", async () => {
    responder({ error: { mensaje: 42, campos: { nombre: null } } }, 422);
    expect(await solicitarApi(peticion)).toEqual({ error: { mensaje: "No se pudo guardar." } });
  });
});

describe("enviarApi de catalogo", () => {
  it("conserva la firma publica y los datos", async () => {
    responder({ datos: { id: "producto-1" } });
    expect(await enviarApi<{ id: string }>(peticion.url, "PATCH", peticion.cuerpo))
      .toEqual({ datos: { id: "producto-1" } });
  });

  it("conserva el mensaje de error sin JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Servicio no disponible", { status: 503 })));
    expect(await enviarApi(peticion.url, "POST", peticion.cuerpo))
      .toEqual({ error: { mensaje: "No se pudo guardar. Intente de nuevo." } });
  });

  it("conserva el mensaje de conexion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await enviarApi(peticion.url, "POST", peticion.cuerpo))
      .toEqual({ error: { mensaje: "No se pudo conectar con el servidor. Revise su conexión." } });
  });
});
