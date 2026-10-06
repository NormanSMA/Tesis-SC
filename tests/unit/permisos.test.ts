import { describe, expect, it } from "vitest";

import { can } from "@/core/autorizacion";
import {
  CATALOGO_PERMISOS,
  destinoPorPerfil,
  PERFILES,
  PERMISOS_POR_PERFIL,
  type PerfilCodigo,
} from "@/core/permisos";

// Copia literal de la tabla "Catálogo de permisos por defecto" (sección c de docs/analisis/05-modelo-datos.md).
// Columnas: Gerencia, Ventas, Producción, Administración. Es la especificación de CF-07.
const TABLA: [string, boolean, boolean, boolean, boolean][] = [
  ["cliente:ver", true, true, false, false],
  ["cliente:gestionar", false, true, false, false],
  ["catalogo:ver", true, true, true, false],
  ["catalogo:gestionar", true, false, false, false],
  ["cotizacion:ver", true, true, false, false],
  ["cotizacion:gestionar", false, true, false, false],
  ["cotizacion:enviar", false, true, false, false],
  ["cotizacion:responder", true, true, false, false],
  ["orden:ver", true, true, true, false],
  ["orden:crear", false, true, false, false],
  ["orden:gestionar", true, true, false, false],
  ["orden:avanzar", false, false, true, false],
  ["orden:entregar", false, true, true, false],
  ["orden:cerrar", true, true, false, false],
  ["orden:cancelar", true, false, false, false],
  ["produccion:ver", true, true, true, false],
  ["produccion:planificar", false, false, true, false],
  ["produccion:ejecutar", false, false, true, false],
  ["inventario:ver", true, true, true, false],
  ["inventario:entrada", false, false, true, false],
  ["inventario:consumir", false, false, true, false],
  ["inventario:ajustar", true, false, false, false],
  ["material:gestionar", true, false, true, false],
  ["bitacora:ver", true, false, false, true],
  ["panel:ver", true, true, true, false],
  ["reporte:ver", true, false, false, false],
  ["reporte:exportar", true, false, false, false],
  ["usuario:gestionar", false, false, false, true],
  ["permiso:gestionar", false, false, false, true],
  ["configuracion:gestionar", false, false, false, true],
];

const PERFILES_EN_ORDEN: PerfilCodigo[] = ["GERENCIA", "VENTAS", "PRODUCCION", "ADMIN"];

function permisosEsperados(indicePerfil: number): string[] {
  return TABLA.filter((fila) => fila[indicePerfil + 1]).map((fila) => fila[0] as string);
}

function actorConPerfil(perfil: PerfilCodigo) {
  return { id: "u1", nombre: "Prueba", correo: "prueba@example.com", perfil, permisos: [...PERMISOS_POR_PERFIL[perfil]] };
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

  it("define los cuatro perfiles con los nombres del modelo", () => {
    expect(PERFILES.map((p) => [p.codigo, p.nombre])).toEqual([
      ["GERENCIA", "Gerencia"],
      ["VENTAS", "Atención al cliente y ventas"],
      ["PRODUCCION", "Producción"],
      ["ADMIN", "Administración del sistema"],
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

  it("Producción consume inventario pero no lo ajusta", () => {
    const produccion = actorConPerfil("PRODUCCION");
    expect(can(produccion, "inventario:consumir")).toBe(true);
    expect(can(produccion, "inventario:ajustar")).toBe(false);
  });

  it("Gerencia ajusta inventario", () => {
    expect(can(actorConPerfil("GERENCIA"), "inventario:ajustar")).toBe(true);
  });

  it("Ventas no gestiona usuarios ni permisos", () => {
    const ventas = actorConPerfil("VENTAS");
    expect(can(ventas, "usuario:gestionar")).toBe(false);
    expect(can(ventas, "permiso:gestionar")).toBe(false);
  });

  it("el destino tras el login de ADMIN es su gestión de usuarios y el de los demás el panel", () => {
    expect(destinoPorPerfil).toEqual({
      GERENCIA: "/panel",
      VENTAS: "/panel",
      PRODUCCION: "/panel",
      ADMIN: "/admin/usuarios",
    });
  });

  it("el destino de cada perfil es una sección que ese perfil puede ver", () => {
    expect(PERMISOS_POR_PERFIL.GERENCIA).toContain("panel:ver");
    expect(PERMISOS_POR_PERFIL.ADMIN).toContain("usuario:gestionar");
  });
});
