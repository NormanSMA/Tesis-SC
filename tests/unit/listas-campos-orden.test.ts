import { describe, expect, it, vi } from "vitest";

import { DIRECCIONES_ORDEN, leerOrden } from "@/lib/listas/orden";
import { CAMPOS_ORDEN_PRODUCTO } from "@/modules/catalogo/campos-orden";
import { ordenProductos } from "@/modules/catalogo/repo";
import { esquemaConsultaProductos } from "@/modules/catalogo/schema";
import { CAMPOS_ORDEN_MATERIAL, CAMPOS_ORDEN_MOVIMIENTO } from "@/modules/inventario/campos-orden";
import { ordenLista as ordenInventario } from "@/modules/inventario/repo";
import { esquemaConsultaMateriales, esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { ORDEN_MATERIAL_DEFECTO, ORDEN_MOVIMIENTO_DEFECTO } from "@/modules/inventario/tipos";
import { CAMPOS_ORDEN_ORDENES } from "@/modules/ordenes/campos-orden";
import { ordenLista as ordenOrdenes } from "@/modules/ordenes/repo";
import { esquemaConsultaOrdenes } from "@/modules/ordenes/schema";
import { CAMPOS_ORDEN_BITACORA } from "@/modules/trazabilidad/campos-orden";
import { esquemaConsultaBitacora } from "@/modules/trazabilidad/schema";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const listas = [
  { modulo: "catálogo", campos: CAMPOS_ORDEN_PRODUCTO, parametro: "orden", esquema: esquemaConsultaProductos },
  { modulo: "inventario: materiales", campos: CAMPOS_ORDEN_MATERIAL, parametro: "ordenar", esquema: esquemaConsultaMateriales },
  { modulo: "inventario: movimientos", campos: CAMPOS_ORDEN_MOVIMIENTO, parametro: "ordenar", esquema: esquemaConsultaMovimientos },
  { modulo: "órdenes", campos: CAMPOS_ORDEN_ORDENES, parametro: "orden", esquema: esquemaConsultaOrdenes },
  { modulo: "trazabilidad", campos: CAMPOS_ORDEN_BITACORA, parametro: "ordenar", esquema: esquemaConsultaBitacora },
] as const;

describe.each(listas)("R7: $modulo", ({ campos, parametro, esquema }) => {
  const ordenes = campos.flatMap((campo) => DIRECCIONES_ORDEN.map((direccion) => ({ campo, direccion })));

  it.each(ordenes)("acepta $campo:$direccion", ({ campo, direccion }) => {
    expect(esquema.parse({ [parametro]: `${campo}:${direccion}` }))
      .toMatchObject({ [parametro]: { campo, direccion } });
  });

  it.each(["fueraDeLista:asc", "fueraDeLista:desc", "nombre; DROP TABLE x", "nombre; DROP TABLE x:asc"])
    ("rechaza %s", (valor) => {
      const lectura = esquema.safeParse({ [parametro]: valor });
      expect(lectura.success).toBe(false);
      if (!lectura.success) expect(lectura.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: [parametro] }),
      ]));
    });
});

describe.each(DIRECCIONES_ORDEN)("desempate por id: %s", (direccion) => {
  it.each(CAMPOS_ORDEN_PRODUCTO)("catálogo: %s", (campo) => {
    const consulta = esquemaConsultaProductos.parse({ orden: `${campo}:${direccion}` });
    const columna = campo === "precio" ? "precioBase" : campo;
    expect(ordenProductos(consulta.orden)).toEqual([{ [columna]: direccion }, { id: direccion }]);
  });

  it.each(CAMPOS_ORDEN_MATERIAL)("materiales: %s", (campo) => {
    const consulta = esquemaConsultaMateriales.parse({ ordenar: `${campo}:${direccion}` });
    expect(ordenInventario(consulta.ordenar, ORDEN_MATERIAL_DEFECTO))
      .toEqual([{ [campo]: direccion }, { id: direccion }]);
  });

  it.each(CAMPOS_ORDEN_MOVIMIENTO)("movimientos: %s", (campo) => {
    const consulta = esquemaConsultaMovimientos.parse({ ordenar: `${campo}:${direccion}` });
    expect(ordenInventario(consulta.ordenar, ORDEN_MOVIMIENTO_DEFECTO))
      .toEqual([{ [campo]: direccion }, { id: direccion }]);
  });

  it.each(CAMPOS_ORDEN_ORDENES)("órdenes: %s", (campo) => {
    const consulta = esquemaConsultaOrdenes.parse({ orden: `${campo}:${direccion}` });
    const principal = campo === "cliente" ? { cliente: { nombre: direccion } } : { [campo]: direccion };
    expect(ordenOrdenes(consulta.orden)).toEqual([principal, { id: direccion }]);
  });
});

describe("orden por defecto", () => {
  it("mantiene el orden de catálogo y órdenes con desempate", () => {
    expect(ordenProductos(undefined)).toEqual([{ nombre: "asc" }, { id: "asc" }]);
    expect(ordenOrdenes(undefined)).toEqual([{ creadoEn: "desc" }, { id: "desc" }]);
  });

  it.each(["fueraDeLista:asc", "nombre; DROP TABLE x", "nombre:arriba", "creadoEn:asc:extra", undefined])
    ("usa el orden de inventario por defecto para %s", (valor) => {
      const material = leerOrden(valor, CAMPOS_ORDEN_MATERIAL) ?? undefined;
      const movimiento = leerOrden(valor, CAMPOS_ORDEN_MOVIMIENTO) ?? undefined;
      expect(ordenInventario(material, ORDEN_MATERIAL_DEFECTO)).toEqual([{ nombre: "asc" }, { id: "asc" }]);
      expect(ordenInventario(movimiento, ORDEN_MOVIMIENTO_DEFECTO)).toEqual([{ creadoEn: "desc" }, { id: "desc" }]);
    });
});
