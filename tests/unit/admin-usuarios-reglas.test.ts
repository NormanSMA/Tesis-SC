import { describe, expect, it } from "vitest";

import { aUsuarioDto } from "@/modules/admin/dto";
import { validarCambioUsuario, validarPerfilesUsuario, validarVersionUsuario } from "@/modules/admin/reglas";

const actual = { id: "admin-a", activo: true, perfiles: ["ADMIN"] as const };

describe("Reglas de usuarios", () => {
  it("valida perfiles también durante creación", () => {
    expect(() => validarPerfilesUsuario({ activo: true, perfiles: [] })).toThrow("Asigne al menos un perfil.");
    expect(() => validarPerfilesUsuario({ activo: true, perfiles: ["PRODUCCION"] })).not.toThrow();
  });
  it("rechaza usuarios activos sin perfiles", () => {
    expect(() => validarCambioUsuario({
      actorId: "admin-b", actual, nuevo: { activo: true, perfiles: [] }, administradoresActivos: 2,
    })).toThrow("Asigne al menos un perfil.");
  });

  it.each([
    { activo: false, perfiles: ["ADMIN"] as const },
    { activo: true, perfiles: ["PRODUCCION"] as const },
  ])("impide desactivar o degradar el ADMIN propio", (nuevo) => {
    expect(() => validarCambioUsuario({
      actorId: actual.id, actual, nuevo, administradoresActivos: 2,
    })).toThrow("No puede quitarse ADMIN ni desactivarse.");
  });

  it.each([
    { activo: false, perfiles: ["ADMIN"] as const },
    { activo: true, perfiles: ["PRODUCCION"] as const },
  ])("conserva el último ADMIN activo", (nuevo) => {
    expect(() => validarCambioUsuario({
      actorId: "admin-b", actual, nuevo, administradoresActivos: 1,
    })).toThrow("Debe conservar al menos un usuario ADMIN activo.");
  });

  it("permite desactivar otro ADMIN cuando existe un ADMIN activo adicional", () => {
    expect(() => validarCambioUsuario({ actorId: "admin-b", actual,
      nuevo: { activo: false, perfiles: ["ADMIN"] }, administradoresActivos: 2 })).not.toThrow();
  });

  it("permite perfiles de negocio adicionales en el ADMIN propio", () => {
    expect(() => validarCambioUsuario({ actorId: actual.id, actual,
      nuevo: { activo: true, perfiles: ["ADMIN", "PRODUCCION"] }, administradoresActivos: 1 })).not.toThrow();
  });

  it("permite reactivar un ADMIN inactivo", () => {
    expect(() => validarCambioUsuario({ actorId: "admin-b", actual: { ...actual, activo: false },
      nuevo: { activo: true, perfiles: ["ADMIN"] }, administradoresActivos: 1 })).not.toThrow();
  });

  it("rechaza una versión obsoleta con CONFLICTO_EDICION", () => {
    const fecha = new Date("2026-10-10T10:00:00.001Z");
    expect(() => validarVersionUsuario(fecha, "2026-10-10T10:00:00.000Z"))
      .toThrow(expect.objectContaining({ codigo: "CONFLICTO_EDICION", status: 409 }));
    expect(() => validarVersionUsuario(fecha, fecha.toISOString())).not.toThrow();
  });

  it("excluye secretos aunque el origen tenga campos adicionales", () => {
    const fecha = new Date("2026-10-10T10:00:00Z");
    const origen = {
      id: "usuario", nombre: "Usuario", correo: "usuario@example.test", activo: true,
      perfiles: [{ perfil: { codigo: "ADMIN" as const } }], intentosFallidos: 0,
      bloqueadoHasta: null, ultimoAcceso: null, creadoEn: fecha, actualizadoEn: fecha,
      hashContrasena: "secreto", claveTemporal: "secreto",
    };
    const dto = aUsuarioDto(origen);
    expect(dto).not.toHaveProperty("hashContrasena");
    expect(dto).not.toHaveProperty("claveTemporal");
    expect(dto.perfiles).toEqual(["ADMIN"]);
  });
});
