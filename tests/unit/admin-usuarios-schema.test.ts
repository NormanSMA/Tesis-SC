import { describe, expect, it } from "vitest";

import { esquemaConsultaUsuarios, esquemaCrearUsuario, esquemaEditarUsuario } from "@/modules/admin/schema";

const entrada = { nombre: " Usuario ", correo: " USUARIO@EXAMPLE.TEST ", perfiles: ["ADMIN"] };

describe("Schema de usuarios", () => {
  it("normaliza nombre y correo", () => {
    expect(esquemaCrearUsuario.parse(entrada)).toEqual({
      nombre: "Usuario", correo: "usuario@example.test", perfiles: ["ADMIN"],
    });
  });

  it.each([[], ["ADMIN", "ADMIN"], ["VENTAS"], ["DESCONOCIDO"]])("rechaza perfiles inválidos: %j", (...perfiles) => {
    expect(esquemaCrearUsuario.safeParse({ ...entrada, perfiles: perfiles.flat() }).success).toBe(false);
  });

  it.each([
    { nombre: " " }, { nombre: "a".repeat(121) }, { correo: "incorrecto" },
    { correo: `${"a".repeat(250)}@example.test` }, { perfiles: undefined },
    { activo: false }, { hashContrasena: "hash" }, { claveTemporal: "clave" },
  ])("rechaza entradas inválidas: %j", (cambio) => {
    expect(esquemaCrearUsuario.safeParse({ ...entrada, ...cambio }).success).toBe(false);
  });

  it("acepta edición parcial y lista completa de perfiles", () => {
    const version = "2026-10-10T10:00:00.000Z";
    expect(esquemaEditarUsuario.parse({ version, perfiles: ["ADMIN", "PRODUCCION"] }).perfiles)
      .toEqual(["ADMIN", "PRODUCCION"]);
    expect(esquemaEditarUsuario.parse({ version, correo: " NUEVO@EXAMPLE.TEST " }).correo)
      .toBe("nuevo@example.test");
  });

  it.each([{ nombre: "Usuario" }, { version: "incorrecta" },
    { version: "2026-10-10T10:00:00Z", activo: false },
    { version: "2026-10-10T10:00:00Z", perfiles: [] },
  ])("rechaza edición inválida: %j", (valor) => {
    expect(esquemaEditarUsuario.safeParse(valor).success).toBe(false);
  });

  it("pagina y conserva filtros opcionales", () => {
    expect(esquemaConsultaUsuarios.parse({})).toEqual({ pagina: 1, porPagina: 20 });
    expect(esquemaConsultaUsuarios.parse({ pagina: "2", porPagina: "10", activo: "false", perfil: "ADMIN" }))
      .toMatchObject({ pagina: 2, porPagina: 10, activo: false, perfil: "ADMIN" });
  });

  it.each([{ pagina: "0" }, { pagina: "1.5" }, { pagina: "100001" },
    { porPagina: "101" }, { activo: "1" }, { perfil: "VENTAS" }, { q: "a".repeat(201) },
  ])("rechaza filtros inválidos: %j", (valor) => {
    expect(esquemaConsultaUsuarios.safeParse(valor).success).toBe(false);
  });
});
