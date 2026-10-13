import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { crearRegistro } from "@/lib/registro";

function memoria() {
  const fragmentos: string[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, terminar) {
      fragmentos.push(fragmento.toString("utf8"));
      terminar();
    },
  });
  return { destino, leer: () => fragmentos.join("") };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registro estructurado", () => {
  it("redacta datos sensibles sin emitir valores secretos", () => {
    vi.stubEnv("LOG_LEVEL", "info");
    const salida = memoria();
    const campos = Object.fromEntries([
      "cookie", "authorization", "contrasena", "contrasenaActual", "contrasenaNueva",
      "clave", "claveTemporal", "hashContrasena", "token", "tokenHash",
    ].map((campo) => [campo, `secreto-${campo}`]));
    crearRegistro(salida.destino).info({ ...campos, req: { headers: campos }, usuario: campos });
    salida.destino.end();

    const texto = salida.leer();
    const datos = JSON.parse(texto);
    for (const campo of Object.keys(campos)) {
      expect(datos[campo]).toBe("[REDACTADO]");
      expect(datos.req.headers[campo]).toBe("[REDACTADO]");
      expect(datos.usuario[campo]).toBe("[REDACTADO]");
    }
    expect(texto).not.toContain("secreto-");
    expect(datos.servicio).toBe("tracore");
    expect(datos.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("serializa un Error con message y type", () => {
    vi.stubEnv("LOG_LEVEL", "error");
    const salida = memoria();
    crearRegistro(salida.destino).error({ err: new Error("Fallo de prueba") });
    salida.destino.end();

    expect(JSON.parse(salida.leer()).err).toMatchObject({
      message: "Fallo de prueba",
      type: "Error",
    });
  });
});

describe("nivel de registro", () => {
  it.each([
    { nivel: undefined, vitest: "", esperado: "silent" },
    { nivel: undefined, vitest: undefined, esperado: "info" },
    { nivel: "debug", vitest: "true", esperado: "debug" },
    { nivel: "silent", vitest: undefined, esperado: "silent" },
  ])("selecciona $esperado con LOG_LEVEL=$nivel y VITEST=$vitest", ({ nivel, vitest, esperado }) => {
    vi.stubEnv("LOG_LEVEL", nivel);
    vi.stubEnv("VITEST", vitest);
    const salida = memoria();
    expect(crearRegistro(salida.destino).level).toBe(esperado);
    salida.destino.end();
  });
});
