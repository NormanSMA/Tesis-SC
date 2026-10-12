import { describe, expect, it } from "vitest";

import { esquemaCambioEstado, esquemaConsultaCategorias, esquemaConsultaMateriales, esquemaConsultaProductos,
  esquemaCrearCategoria, esquemaCrearProducto, esquemaEditarCategoria, esquemaEditarProducto, esquemaReceta, objetoDeParametros } from "@/modules/catalogo/schema";

const id = "00000000-0000-4000-8000-000000000001";
const version = "2026-10-06T12:00:00.000Z";
const producto = { codigo: "P-01", nombre: "Lona", categoriaId: id, unidadCobro: "M2", precioBase: "12.50" };

describe("catálogo: esquemas", () => {
  it("normaliza el costo opcional con cuatro decimales y preserva su omisión", () => {
    expect(esquemaCrearProducto.parse(producto)).not.toHaveProperty("costoUnitario");
    expect(esquemaEditarProducto.parse({ version })).not.toHaveProperty("costoUnitario");
    for (const costoUnitario of [null, "", "   "]) {
      expect(esquemaCrearProducto.parse({ ...producto, costoUnitario }).costoUnitario).toBeNull();
      expect(esquemaEditarProducto.parse({ version, costoUnitario }).costoUnitario).toBeNull();
    }
    for (const [entrada, esperado] of [["0", "0.0000"], [" 12.3456 ", "12.3456"], ["1.2", "1.2000"], ["9999999999.9999", "9999999999.9999"]]) {
      expect(esquemaCrearProducto.parse({ ...producto, costoUnitario: entrada }).costoUnitario).toBe(esperado);
    }
  });
  it.each([12, "-1", "0.00001", "1,5", "1e2", "10000000000", "NaN", "Infinity"])("rechaza costo %s en creación y edición", (costoUnitario) => {
    for (const resultado of [esquemaCrearProducto.safeParse({ ...producto, costoUnitario }), esquemaEditarProducto.safeParse({ version, costoUnitario })]) {
      expect(resultado.success).toBe(false);
      if (!resultado.success) expect(resultado.error.issues[0].path).toEqual(["costoUnitario"]);
    }
  });
  it("normaliza espacios y descripción vacía", () => {
    expect(esquemaCrearProducto.parse({ ...producto, codigo: " P-01 ", nombre: " Lona ", descripcion: " " }))
      .toMatchObject({ codigo: "P-01", nombre: "Lona", descripcion: null });
  });
  it("limita la descripción a 2000 caracteres en producto y categoría", () => {
    const largo = "d".repeat(2001);
    const casos = [
      [esquemaCrearProducto, producto], [esquemaEditarProducto, { version }],
      [esquemaCrearCategoria, { nombre: "Rótulos" }], [esquemaEditarCategoria, { version }],
    ] as const;
    for (const [esquema, base] of casos) {
      expect(esquema.safeParse({ ...base, descripcion: "d".repeat(2000) }).success).toBe(true);
      const resultado = esquema.safeParse({ ...base, descripcion: largo });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].path).toEqual(["descripcion"]);
        expect(resultado.error.issues[0].message).toBe("Admite hasta 2000 caracteres.");
      }
    }
  });
  it.each(["codigo", "nombre", "categoriaId", "unidadCobro", "precioBase"])("exige %s", (campo) => {
    expect(esquemaCrearProducto.safeParse({ ...producto, [campo]: undefined }).success).toBe(false);
  });
  it("rechaza campos vacíos, extensos y UUID inválido", () => {
    for (const entrada of [{ nombre: " " }, { codigo: "a".repeat(31) }, { nombre: "a".repeat(161) }, { categoriaId: "abc" }]) {
      expect(esquemaCrearProducto.safeParse({ ...producto, ...entrada }).success).toBe(false);
    }
  });
  it.each([12, "-1", "1,5", "1e2", "1.001", "1000000000000"])("rechaza precio %s mediante el motor", (precioBase) => {
    expect(esquemaCrearProducto.safeParse({ ...producto, precioBase }).success).toBe(false);
  });
  it("acepta cero, máximo y ceros finales", () => {
    for (const precioBase of ["0", "999999999999.99", "1.50000"]) {
      expect(esquemaCrearProducto.safeParse({ ...producto, precioBase }).success).toBe(true);
    }
  });
  it("exige versión en toda escritura existente", () => {
    for (const esquema of [esquemaEditarProducto, esquemaCambioEstado, esquemaReceta, esquemaEditarCategoria]) {
      expect(esquema.safeParse({}).success).toBe(false);
    }
  });
  it("rechaza campos ajenos en PATCH y preserva campos omitidos", () => {
    expect(esquemaEditarProducto.parse({ version, nombre: "Nuevo" })).toEqual({ version, nombre: "Nuevo" });
    for (const campo of ["activo", "id", "creadoEn", "actualizadoEn", "receta"]) {
      expect(esquemaEditarProducto.safeParse({ version, [campo]: "x" }).success).toBe(false);
    }
  });
  it("acepta receta opcional vacía y rechaza materiales repetidos", () => {
    expect(esquemaReceta.parse({ version, materiales: [] }).materiales).toEqual([]);
    expect(esquemaReceta.safeParse({ version, materiales: [
      { materialId: id, cantidad: "1" }, { materialId: id, cantidad: "2" },
    ] }).success).toBe(false);
  });
  it.each([0, "0", "-1", "0.0001", "100000000000", "1,2"])("rechaza cantidad %s", (cantidad) => {
    expect(esquemaReceta.safeParse({ version, materiales: [{ materialId: id, cantidad }] }).success).toBe(false);
  });
  it("acepta cantidades con tres decimales y ceros finales", () => {
    expect(esquemaReceta.parse({ version, materiales: [{ materialId: id, cantidad: "1.00100" }] }).materiales).toHaveLength(1);
  });
  it("valida categorías y permite cambiar estado con versión", () => {
    expect(esquemaCrearCategoria.parse({ nombre: " Categoría ", descripcion: " " })).toEqual({ nombre: "Categoría", descripcion: null });
    expect(esquemaCrearCategoria.safeParse({ nombre: "a".repeat(81) }).success).toBe(false);
    expect(esquemaEditarCategoria.parse({ version, activo: false })).toEqual({ version, activo: false });
  });
  it("valida paginación, búsqueda, categoría y estado", () => {
    expect(esquemaConsultaProductos.parse({})).toEqual({ activo: true, pagina: 1, porPagina: 20 });
    for (const entrada of [{ pagina: "0" }, { pagina: "100001" }, { porPagina: "101" }, { activo: "todos" }, { categoriaId: "abc" }]) {
      expect(esquemaConsultaProductos.safeParse(entrada).success).toBe(false);
    }
  });
  it("consulta solo materiales activos por defecto y todas las categorías", () => {
    expect(esquemaConsultaMateriales.parse({})).toEqual({ activo: true });
    expect(esquemaConsultaCategorias.parse({}).activo).toBeUndefined();
  });
  it("normaliza parámetros GET y la selección Todas", () => {
    expect(objetoDeParametros(new URLSearchParams("q=+Lona+&categoriaId=todas&activo=false"))).toEqual({ q: "Lona", activo: "false" });
    expect(objetoDeParametros({ q: [" Lona ", "Otro"], pagina: undefined })).toEqual({ q: "Lona" });
  });
});
