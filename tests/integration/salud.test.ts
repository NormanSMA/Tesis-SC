import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { describeConBase } from "../helpers/db";
import { urlApp } from "../helpers/entorno-bd";

type RutaSalud = typeof import("@/app/api/v1/salud/route");

const globales = globalThis as unknown as { prisma?: { $disconnect(): Promise<void> } };

async function liberarClienteGlobal() {
  await globales.prisma?.$disconnect();
  delete globales.prisma;
}

// src/lib/db.ts guarda el cliente en globalThis y lee DATABASE_URL al importarse.
// Para probar otra URL hay que soltar ese cliente y reimportar la ruta.
async function cargarRuta(databaseUrl: string): Promise<RutaSalud> {
  await liberarClienteGlobal();
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", databaseUrl);
  return import("@/app/api/v1/salud/route");
}

describeConBase("GET /api/v1/salud", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await liberarClienteGlobal();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("responde 200 con la base disponible", async () => {
    const { GET } = await cargarRuta(urlApp());
    const respuesta = await GET();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ datos: { estado: "ok", baseDatos: "ok" } });
  });

  it("responde 503 con formato de error cuando la base no responde", async () => {
    const { GET } = await cargarRuta("postgresql://sc_app:x@127.0.0.1:1/inexistente?schema=public");
    const respuesta = await GET();
    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toEqual({
      error: { codigo: "BASE_DATOS_NO_DISPONIBLE", mensaje: "La base de datos no responde." },
    });
  });
});
