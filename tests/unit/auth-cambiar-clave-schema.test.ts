import { describe, expect, it } from "vitest";

import { esquemaCambiarClave } from "@/modules/auth/schema";

const entrada = { claveActual: "Clave-actual-123", claveNueva: "Clave-nueva-456" };

describe("validación del cambio de clave", () => {
  it("acepta una clave nueva de 14 caracteres", () => {
    expect(esquemaCambiarClave.parse({ ...entrada, claveNueva: "a".repeat(14) }).claveNueva).toHaveLength(14);
  });

  it.each(["", "a".repeat(13), "a".repeat(257)])("rechaza una clave nueva inválida: %s", (claveNueva) => {
    const resultado = esquemaCambiarClave.safeParse({ ...entrada, claveNueva });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["claveNueva"]);
  });

  it("rechaza reutilizar la clave actual", () => {
    const resultado = esquemaCambiarClave.safeParse({ ...entrada, claveNueva: entrada.claveActual });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["claveNueva"]);
  });

  it.each([{}, { ...entrada, claveActual: "" }, { ...entrada, claveActual: "a".repeat(257) },
    { ...entrada, claveNueva: null }, { ...entrada, claveActual: 123 },
  ])("rechaza campos ausentes o inválidos: %j", (cuerpo) => {
    expect(esquemaCambiarClave.safeParse(cuerpo).success).toBe(false);
  });

  it("conserva los espacios de ambas claves", () => {
    const cuerpo = { claveActual: " clave actual ", claveNueva: " clave nueva 123 " };
    expect(esquemaCambiarClave.parse(cuerpo)).toEqual(cuerpo);
  });
});
