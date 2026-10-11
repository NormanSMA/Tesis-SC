import { describe, expect, it } from "vitest";

import { can } from "@/core/autorizacion";
import {
  CATALOGO_PERMISOS,
  destinoPorPerfil,
  PERFILES,
  PERMISOS_POR_PERFIL,
  type PerfilCodigo,
} from "@/core/permisos";

// Matriz completa de docs/modulos/09-perfiles-v9.md: GER, ADM, OPE, ATC, PRO, ADMIN.
const TABLA: [string, boolean, boolean, boolean, boolean, boolean, boolean][] = [
  ["cliente:ver", true, false, true, true, false, false],
  ["cliente:gestionar", false, false, false, true, false, false],
  ["catalogo:ver", true, true, true, true, true, false],
  ["catalogo:gestionar", false, false, true, false, false, false],
  ["cotizacion:ver", true, true, true, true, false, false],
  ["cotizacion:gestionar", false, false, false, true, false, false],
  ["cotizacion:enviar", false, false, false, true, false, false],
  ["cotizacion:responder", false, false, true, true, false, false],
  ["orden:ver", true, true, true, true, true, false],
  ["orden:crear", false, false, true, false, false, false],
  ["orden:gestionar", false, true, true, false, false, false],
  ["orden:avanzar", false, true, true, false, true, false],
  ["orden:entregar", false, false, true, true, false, false],
  ["orden:cerrar", false, false, true, true, false, false],
  ["orden:cancelar", false, false, true, false, false, false],
  ["produccion:ver", true, true, true, true, true, false],
  ["produccion:planificar", false, true, true, false, false, false],
  ["produccion:ejecutar", false, true, false, false, true, false],
  ["inventario:ver", true, true, true, false, false, false],
  ["inventario:entrada", false, true, false, false, false, false],
  ["inventario:consumir", false, true, false, false, false, false],
  ["inventario:ajustar", false, true, false, false, false, false],
  ["material:gestionar", false, true, false, false, false, false],
  ["bitacora:ver", true, false, false, false, false, true],
  ["panel:ver", true, true, true, true, true, false],
  ["reporte:ver", true, false, false, false, false, false],
  ["reporte:exportar", true, false, false, false, false, false],
  ["usuario:gestionar", false, false, false, false, false, true],
  ["permiso:gestionar", false, false, false, false, false, true],
  ["configuracion:gestionar", false, false, false, false, false, true],
];

const PERFILES_EN_ORDEN: PerfilCodigo[] = ["GERENCIA", "ADMINISTRACION", "OPERACIONES", "ATENCION_CLIENTE", "PRODUCCION", "ADMIN"];

function permisosEsperados(indicePerfil: number): string[] {
  return TABLA.filter((fila) => fila[indicePerfil + 1]).map((fila) => fila[0] as string);
}

function actorConPerfil(perfil: PerfilCodigo) {
  return { id: "u1", nombre: "Prueba", correo: "prueba@example.com", perfil, perfiles: [perfil], permisos: [...PERMISOS_POR_PERFIL[perfil]] };
}

describe("matriz de permisos por defecto", () => {
  it("el catálogo coincide con las filas de la tabla del modelo", () => {
    expect(CATALOGO_PERMISOS.map((c) => c.permiso).sort()).toEqual(TABLA.map((f) => f[0]).sort());
  });

  it("no repite permisos y todos tienen descripción", () => {
    const codigos = CATALOGO_PERMISOS.map((c) => c.permiso);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(CATALOGO_PERMISOS.every((c) => c.descripcion.length > 0)).toBe(true);
  });

  PERFILES_EN_ORDEN.forEach((perfil, indice) => {
    it(`${perfil} recibe exactamente los permisos de su columna`, () => {
      expect([...PERMISOS_POR_PERFIL[perfil]].sort()).toEqual(permisosEsperados(indice).sort());
    });
  });

  it("define los seis perfiles con los nombres del modelo", () => {
    expect(PERFILES.map((p) => [p.codigo, p.nombre])).toEqual([
      ["GERENCIA", "Gerencia"],
      ["ADMINISTRACION", "Administración"],
      ["OPERACIONES", "Operaciones"],
      ["ATENCION_CLIENTE", "Atención al cliente"],
      ["PRODUCCION", "Producción"],
      ["ADMIN", "Administración técnica"],
    ]);
  });

  it("los permisos tienen la forma recurso:accion válida para la base", () => {
    for (const { permiso } of CATALOGO_PERMISOS) expect(permiso).toMatch(/^[a-z][a-z_]*:[a-z][a-z_]*$/);
  });
});

describe("reglas de negocio de CF-07", () => {
  it("ADMIN no tiene permisos de negocio", () => {
    const negocio = ["cliente", "catalogo", "cotizacion", "orden", "produccion", "inventario", "material", "panel", "reporte"];
    const admin = PERMISOS_POR_PERFIL.ADMIN;
    expect(admin.filter((p) => negocio.includes(p.split(":")[0]))).toEqual([]);
  });

  it("Producción no consulta ni consume ni ajusta inventario", () => {
    const produccion = actorConPerfil("PRODUCCION");
    expect(can(produccion, "inventario:ver")).toBe(false);
    expect(can(produccion, "inventario:consumir")).toBe(false);
    expect(can(produccion, "inventario:ajustar")).toBe(false);
  });

  it("Administración ajusta inventario y Gerencia solo consulta", () => {
    expect(can(actorConPerfil("ADMINISTRACION"), "inventario:ajustar")).toBe(true);
    expect(can(actorConPerfil("GERENCIA"), "inventario:ver")).toBe(true);
    expect(can(actorConPerfil("GERENCIA"), "inventario:ajustar")).toBe(false);
  });

  it("Atención al cliente no gestiona usuarios ni permisos", () => {
    const atencion = actorConPerfil("ATENCION_CLIENTE");
    expect(can(atencion, "usuario:gestionar")).toBe(false);
    expect(can(atencion, "permiso:gestionar")).toBe(false);
  });

  it("el destino tras el login de ADMIN es su gestión de usuarios y el de los demás el panel", () => {
    expect(destinoPorPerfil).toEqual({
      GERENCIA: "/panel",
      ADMINISTRACION: "/panel",
      OPERACIONES: "/panel",
      ATENCION_CLIENTE: "/panel",
      PRODUCCION: "/panel",
      ADMIN: "/admin/usuarios",
    });
  });

  it("el destino de cada perfil es una sección que ese perfil puede ver", () => {
    for (const perfil of PERFILES_EN_ORDEN) {
      expect(PERMISOS_POR_PERFIL[perfil]).toContain(perfil === "ADMIN" ? "usuario:gestionar" : "panel:ver");
    }
  });
});
