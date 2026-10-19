import { describe, expect, it } from "vitest";

import { construirMigas } from "@/components/layout/Migas";
import { filtrarNavegacion, gruposNavegacion, itemActivo } from "@/components/layout/navegacion";

function hrefs(permisos: string[]): string[] {
  return filtrarNavegacion(gruposNavegacion, permisos).flatMap((grupo) => grupo.items.map((item) => item.href));
}

describe("filtrarNavegacion", () => {
  it("no muestra nada sin permisos", () => {
    expect(filtrarNavegacion(gruposNavegacion, [])).toEqual([]);
  });

  it("muestra solo lo permitido", () => {
    expect(hrefs(["panel:ver", "cliente:ver"])).toEqual(["/panel", "/clientes"]);
  });

  it("oculta el grupo de administración sin permisos de gestión", () => {
    const grupos = filtrarNavegacion(gruposNavegacion, ["panel:ver", "reporte:ver"]);
    expect(grupos.map((grupo) => grupo.id)).toEqual(["operacion", "analisis"]);
  });

  it("muestra el grupo de administración con un permiso de gestión", () => {
    expect(hrefs(["usuario:gestionar"])).toEqual(["/admin/usuarios"]);
  });

  it("declara los doce permisos del brief", () => {
    const permisos = gruposNavegacion.flatMap((grupo) => grupo.items.map((item) => item.permiso));
    expect(permisos).toHaveLength(12);
    expect(new Set(permisos).size).toBe(12);
  });
});

describe("itemActivo y construirMigas", () => {
  it("encuentra el ítem por prefijo de ruta", () => {
    expect(itemActivo(gruposNavegacion, "/clientes/nuevo")?.href).toBe("/clientes");
  });

  it("arma migas con grupo y sección", () => {
    expect(construirMigas("/admin/usuarios").map((miga) => miga.etiqueta)).toEqual(["Administración técnica", "Usuarios"]);
  });

  it("nombra el detalle con un identificador numérico", () => {
    const migas = construirMigas("/ordenes/18");
    expect(migas.map((miga) => miga.etiqueta)).toEqual(["Órdenes de trabajo", "Detalle"]);
    expect(migas[0].href).toBe("/ordenes");
  });

  it("no genera migas fuera de la navegación", () => {
    expect(construirMigas("/diseno")).toEqual([]);
  });
});
