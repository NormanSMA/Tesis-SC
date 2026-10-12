import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const raiz = path.resolve(import.meta.dirname, "..", "..");

describe("reparto de pruebas por secciones", () => {
  it("todo archivo de prueba pertenece a una sola sección", () => {
    const resultado = spawnSync(process.execPath, ["scripts/pruebas/secciones.mjs", "--verificar"], { cwd: raiz, encoding: "utf8" });
    expect(`${resultado.stderr}${resultado.stdout}`).toContain("pertenecen a una sección");
    expect(resultado.status).toBe(0);
  });
});
