import { describe, expect, it } from "vitest";

import { esquemaCrearCliente } from "@/modules/clientes/schema";
import { esTelefonoValido } from "@/modules/clientes/telefono";

describe("teléfono de cliente", () => {
  it.each([
    "+505 8756-8901",
    "+506 8888-8888",
    "+1 305 555 0123",
    "+1 (305) 555-0123",
    "8756-8901",
    "8888 0000",
    "2713.4455",
  ])("acepta %s", (telefono) => {
    expect(esTelefonoValido(telefono)).toBe(true);
  });

  it.each([
    ["letras", "8756-abcd"],
    ["muy corto", "8888"],
    ["demasiados dígitos", "+505 8756 8901 2345 6"],
    ["símbolo fuera de lugar", "8756+8901"],
    ["solo separadores", "- - -"],
    ["texto libre", "llamar a Juan"],
  ])("rechaza %s", (_motivo, telefono) => {
    expect(esTelefonoValido(telefono)).toBe(false);
  });

  it("el esquema de alta informa el error en el campo teléfono", () => {
    const resultado = esquemaCrearCliente.safeParse({ nombre: "A", tipo: "PERSONA", telefono: "llamar a Juan" });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["telefono"]);
  });

  it("el esquema acepta un teléfono extranjero con código de país", () => {
    const resultado = esquemaCrearCliente.safeParse({ nombre: "A", tipo: "PERSONA", telefono: "+1 305 555 0123" });
    expect(resultado.success).toBe(true);
  });
});
