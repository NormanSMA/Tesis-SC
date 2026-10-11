import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { aFichaProducto, aProductoDto, type FilaFicha } from "@/modules/catalogo/dto";

const fecha = new Date("2026-10-10T12:00:00.000Z");
const producto: FilaFicha = {
  id: "producto", codigo: "P-01", nombre: "Lona", descripcion: null,
  categoriaId: "categoria", unidadCobro: "M2", precioBase: new Prisma.Decimal("100"),
  costoUnitario: new Prisma.Decimal("12.3456"), activo: true, creadoEn: fecha, actualizadoEn: fecha,
  categoria: { id: "categoria", nombre: "Lonas", descripcion: null, activo: true, actualizadoEn: fecha },
  receta: [],
};

describe("catálogo: costo de referencia en DTO", () => {
  it("expone cuatro decimales y distingue cero de costo ausente", () => {
    expect(aProductoDto(producto, true).costoUnitario).toBe("12.3456");
    expect(aFichaProducto(producto, true).costoUnitario).toBe("12.3456");
    expect(aProductoDto({ ...producto, costoUnitario: new Prisma.Decimal(0) }, true).costoUnitario).toBe("0.0000");
    expect(aProductoDto({ ...producto, costoUnitario: null }, true).costoUnitario).toBeNull();
  });
  it("omite el costo en lista y ficha cuando no se autoriza mostrarlo", () => {
    expect(aProductoDto(producto, false)).not.toHaveProperty("costoUnitario");
    expect(aFichaProducto(producto, false)).not.toHaveProperty("costoUnitario");
  });
});
