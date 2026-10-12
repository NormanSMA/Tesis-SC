import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { cifrar, descifrar } from "../../scripts/respaldo/cifrado.mjs";

const FRASE = "frase-de-prueba-solo-para-el-test";

describe("cifrado de respaldos", () => {
  it("recupera exactamente el contenido original", () => {
    const original = randomBytes(200_000);
    const cifrado = cifrar(original, FRASE);
    expect(cifrado.equals(original)).toBe(false);
    expect(descifrar(cifrado, FRASE).equals(original)).toBe(true);
  });

  it("produce un archivo distinto en cada cifrado (sal e iv aleatorios)", () => {
    const original = Buffer.from("PGDMP-respaldo");
    expect(cifrar(original, FRASE).equals(cifrar(original, FRASE))).toBe(false);
  });

  it("rechaza una clave incorrecta", () => {
    const cifrado = cifrar(Buffer.from("datos"), FRASE);
    expect(() => descifrar(cifrado, "otra-frase-que-no-es-la-correcta")).toThrow(/clave incorrecta/);
  });

  it("detecta un archivo alterado", () => {
    const cifrado = cifrar(Buffer.from("datos importantes"), FRASE);
    cifrado[cifrado.length - 20] ^= 0xff;
    expect(() => descifrar(cifrado, FRASE)).toThrow(/alterado/);
  });

  it("rechaza archivos que no son respaldos cifrados y claves cortas", () => {
    expect(() => descifrar(Buffer.from("texto plano cualquiera de relleno largo"), FRASE)).toThrow(/no es un respaldo cifrado/);
    expect(() => cifrar(Buffer.from("x"), "corta")).toThrow(/al menos 14 caracteres/);
  });
});
