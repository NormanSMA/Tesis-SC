import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CATALOGO_PERMISOS, type PerfilCodigo } from "@/core/permisos";
import { aPermisosPerfilDto, versionPermisos } from "@/modules/admin/permisos-dto";
import {
  calcularDiferenciasPermisos, esquemaPerfilPermisos, esquemaReemplazarPermisos,
  PERMISOS_PROTEGIDOS, validarPermisosPerfil,
} from "@/modules/admin/permisos-schema";

const VERSION = versionPermisos([]);

describe("schema de permisos", () => {
  it("acepta el catálogo completo y la lista vacía", () => {
    expect(esquemaReemplazarPermisos.safeParse({ permisos: [], version: VERSION }).success).toBe(true);
    expect(esquemaReemplazarPermisos.safeParse({
      permisos: CATALOGO_PERMISOS.map(({ permiso }) => permiso),
      version: VERSION,
    }).success).toBe(true);
  });

  it.each([
    {}, { permisos: ["cliente:borrar"], version: VERSION },
    { permisos: ["cliente:ver", "cliente:ver"], version: VERSION },
    { permisos: "cliente:ver", version: VERSION }, { permisos: [], version: VERSION, actorId: "ajeno" },
    { permisos: [] }, { permisos: [], version: null }, { permisos: [], version: "" },
    { permisos: [], version: "a".repeat(63) }, { permisos: [], version: "a".repeat(65) },
    { permisos: [], version: "g".repeat(64) },
  ])("rechaza una entrada inválida: %j", (entrada) => {
    expect(esquemaReemplazarPermisos.safeParse(entrada).success).toBe(false);
  });

  it("valida el código del perfil", () => {
    expect(esquemaPerfilPermisos.safeParse("ADMIN").success).toBe(true);
    expect(esquemaPerfilPermisos.safeParse("admin").success).toBe(false);
  });
});

describe("versión de permisos", () => {
  it("calcula SHA-256 de los códigos ordenados sin modificar la entrada", () => {
    const permisos = ["panel:ver", "cliente:ver"];
    const esperado = createHash("sha256").update('["cliente:ver","panel:ver"]').digest("hex");
    expect(versionPermisos(permisos)).toBe(esperado);
    expect(versionPermisos([...permisos].reverse())).toBe(esperado);
    expect(permisos).toEqual(["panel:ver", "cliente:ver"]);
    expect(versionPermisos(["panel:ver"])).not.toBe(esperado);
    expect(versionPermisos([])).toBe(createHash("sha256").update("[]").digest("hex"));
  });

  it("incluye la versión de los permisos concedidos en el DTO del perfil", () => {
    expect(aPermisosPerfilDto({
      id: "perfil", codigo: "PRODUCCION", nombre: "Producción", descripcion: null,
      permisos: [{ permiso: { id: "permiso", recurso: "panel", accion: "ver" } }],
    })).toEqual({ perfil: "PRODUCCION", permisos: ["panel:ver"], version: versionPermisos(["panel:ver"]) });
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
