import { describe, expect, it } from "vitest";
import { z } from "zod";

import { leerDecimal } from "@/core/decimal";
import { LIMITE_CUERPO_BYTES, leerJson } from "@/lib/http";

const esquema = z.object({ texto: z.string() });

function peticion(cuerpo: string, cabeceras: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/prueba", { method: "POST", body: cuerpo, headers: cabeceras });
}

describe("límites de entrada", () => {
  it("acepta un cuerpo JSON dentro del límite", async () => {
    await expect(leerJson(peticion(JSON.stringify({ texto: "hola" })), esquema)).resolves.toEqual({ texto: "hola" });
  });

  it("rechaza con 413 un cuerpo mayor que el límite", async () => {
    const grande = JSON.stringify({ texto: "a".repeat(LIMITE_CUERPO_BYTES) });
    await expect(leerJson(peticion(grande), esquema)).rejects.toMatchObject({ status: 413, codigo: "CUERPO_DEMASIADO_GRANDE" });
  });

  it("rechaza con 413 por Content-Length antes de leer el cuerpo", async () => {
    const solicitud = peticion("{}", { "content-length": String(LIMITE_CUERPO_BYTES + 1) });
    await expect(leerJson(solicitud, esquema)).rejects.toMatchObject({ status: 413 });
  });

  it("sigue rechazando JSON inválido con 400", async () => {
    await expect(leerJson(peticion("{no es json"), esquema)).rejects.toMatchObject({ status: 400, codigo: "JSON_INVALIDO" });
    await expect(leerJson(peticion(""), esquema)).rejects.toMatchObject({ status: 400, codigo: "JSON_INVALIDO" });
  });

  it("leerDecimal descarta cadenas excesivamente largas antes de convertir a BigInt", () => {
    expect(leerDecimal("1250.5")).not.toBeNull();
    expect(leerDecimal(`1.${"0".repeat(400_000)}`)).toBeNull();
  });
});
