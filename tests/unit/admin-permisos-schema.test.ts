import { describe, expect, it } from "vitest";

import { CATALOGO_PERMISOS, type PerfilCodigo } from "@/core/permisos";
import {
  calcularDiferenciasPermisos, esquemaPerfilPermisos, esquemaReemplazarPermisos,
  PERMISOS_PROTEGIDOS, validarPermisosPerfil,
} from "@/modules/admin/permisos-schema";

describe("schema de permisos", () => {
  it("acepta el catálogo completo y la lista vacía", () => {
    expect(esquemaReemplazarPermisos.safeParse({ permisos: [] }).success).toBe(true);
    expect(esquemaReemplazarPermisos.safeParse({
      permisos: CATALOGO_PERMISOS.map(({ permiso }) => permiso),
    }).success).toBe(true);
  });

  it.each([
    {}, { permisos: ["cliente:borrar"] }, { permisos: ["cliente:ver", "cliente:ver"] },
    { permisos: "cliente:ver" }, { permisos: [], actorId: "ajeno" },
  ])("rechaza una entrada inválida: %j", (entrada) => {
    expect(esquemaReemplazarPermisos.safeParse(entrada).success).toBe(false);
  });

  it("valida el código del perfil", () => {
    expect(esquemaPerfilPermisos.safeParse("ADMIN").success).toBe(true);
    expect(esquemaPerfilPermisos.safeParse("admin").success).toBe(false);
  });
});

describe("reglas de permisos", () => {
  it.each(PERMISOS_PROTEGIDOS)("impide revocar %s de ADMIN", (protegido) => {
    expect(() => validarPermisosPerfil("ADMIN", PERMISOS_PROTEGIDOS.filter((p) => p !== protegido)))
      .toThrow(expect.objectContaining({ codigo: "PERMISO_PROTEGIDO", status: 422 }));
  });

  it("permite asignar permisos de negocio a ADMIN", () => {
    expect(() => validarPermisosPerfil("ADMIN", [...PERMISOS_PROTEGIDOS, "cliente:gestionar"]))
      .not.toThrow();
  });

  it.each<PerfilCodigo>([
    "GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION",
  ])("permite vaciar los permisos de %s", (perfil) => {
    expect(() => validarPermisosPerfil(perfil, [])).not.toThrow();
  });

  it("calcula altas y bajas sin repetir asignaciones existentes", () => {
    expect(calcularDiferenciasPermisos(["cliente:ver", "panel:ver"], ["panel:ver", "orden:ver"]))
      .toEqual({ altas: ["orden:ver"], bajas: ["cliente:ver"] });
    expect(calcularDiferenciasPermisos(["panel:ver"], ["panel:ver"]))
      .toEqual({ altas: [], bajas: [] });
  });
});
