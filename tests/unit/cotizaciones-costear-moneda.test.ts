import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { costearItems } from "@/modules/cotizaciones/costear";
import type { EntradaItem } from "@/modules/cotizaciones/schema";

const TIPO_CAMBIO = "36.6243";
const PRODUCTO_ID = "11111111-1111-4111-8111-111111111111";
const MATERIAL_ID = "22222222-2222-4222-8222-222222222222";
const CATEGORIA_ID = "33333333-3333-4333-8333-333333333333";

const txFalso = {
  producto: { findMany: async () => [{ id: PRODUCTO_ID, activo: true, categoriaId: CATEGORIA_ID, nombre: "Rótulo",
    unidadCobro: "UNIDAD", precioBase: new Prisma.Decimal("1320") }] },
  material: { findMany: async () => [{ id: MATERIAL_ID, activo: true, costoPromedio: new Prisma.Decimal("2850") }] },
  categoria: { findMany: async () => [{ id: CATEGORIA_ID, activo: true }] },
} as unknown as Tx;

const catalogo: EntradaItem = { tipo: "CATALOGO", productoId: PRODUCTO_ID, cantidad: "3" };
const personalizado: EntradaItem = { tipo: "PERSONALIZADO", categoriaId: CATEGORIA_ID, descripcion: "Trabajo",
  cantidad: "1", unidadCobro: "UNIDAD", margenPct: "35", lineas: [
    { tipo: "MATERIAL", descripcion: "Material", unidad: "unidad", materialId: MATERIAL_ID, cantidad: "5", mermaPct: "0" },
    { tipo: "MATERIAL", descripcion: "Compra especial", unidad: "unidad", cantidad: "2", costoUnitario: "10.125", mermaPct: "0" },
    { tipo: "MANO_OBRA", descripcion: "Horas", unidad: "hora", horas: "4", tarifa: "5" },
    { tipo: "TERCERO", descripcion: "Externo", unidad: "servicio", costo: "20" },
  ] };

describe("costeo de cotizaciones en dos monedas", () => {
  it("convierte el precio base del catálogo a 2 decimales", async () => {
    const [item] = await costearItems(txFalso, { items: [catalogo], anteriores: [], tipoCambio: TIPO_CAMBIO });
    expect(item).toMatchObject({ precioUnitario: "36.04", importe: "108.12" });
  });

  it("deja el precio de catálogo en córdobas con tipo de cambio 1", async () => {
    const [item] = await costearItems(txFalso, { items: [catalogo], anteriores: [], tipoCambio: "1" });
    expect(item).toMatchObject({ precioUnitario: "1320.00", importe: "3960.00" });
  });

  it("convierte solo el costo promedio del material registrado a 4 decimales", async () => {
    const [item] = await costearItems(txFalso, { items: [personalizado], anteriores: [], tipoCambio: TIPO_CAMBIO });
    expect(item.lineas.map((linea) => linea.costoUnitario)).toEqual(["77.8172", "10.1250", "5.0000", "20.0000"]);
  });
});
