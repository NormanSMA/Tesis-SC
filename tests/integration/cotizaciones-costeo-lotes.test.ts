import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { totalizarCotizacion } from "@/core/costeo";
import { costearItems } from "@/modules/cotizaciones/costear";
import type { EntradaItem } from "@/modules/cotizaciones/schema";

import { liberarClienteGlobal } from "../helpers/auth";
import { crearClientePropietario, describeConBase } from "../helpers/db";
import { crearReferencias, itemPersonalizado, itemUnidad, type Referencias } from "./cotizaciones-ayudas";

describeConBase("cotizaciones: lecturas de costeo por lotes", () => {
  const db = crearClientePropietario();
  let referencias: Referencias;
  beforeAll(async () => { referencias = await crearReferencias(db); });
  afterAll(async () => { await liberarClienteGlobal(); await db.$disconnect(); });

  async function medirCosteo(items: EntradaItem[]) {
    return db.$transaction(async (tx) => {
      const espias = [
        vi.spyOn(tx.producto, "findMany"), vi.spyOn(tx.producto, "findUnique"),
        vi.spyOn(tx.material, "findMany"), vi.spyOn(tx.material, "findUnique"),
        vi.spyOn(tx.categoria, "findMany"), vi.spyOn(tx.categoria, "findUnique"),
      ];
      try {
        const costeados = await costearItems(tx, { items, anteriores: [] });
        return { costeados, lecturas: espias.map((espia) => espia.mock.calls.length),
          filtros: espias.map((espia) => espia.mock.calls.map(([consulta]) => consulta?.where)) };
      } finally { espias.forEach((espia) => espia.mockRestore()); }
    });
  }

  it("mantiene una lectura para 50 ítems del mismo producto y conserva los totales", async () => {
    const uno = await medirCosteo([itemUnidad(referencias)]);
    const lote = await medirCosteo(Array.from({ length: 50 }, () => itemUnidad(referencias)));
    expect(uno.lecturas).toEqual([1, 0, 0, 0, 0, 0]);
    expect(lote.lecturas).toEqual(uno.lecturas);
    expect(lote.filtros[0]).toEqual([{ id: { in: [referencias.unidad.id] } }]);
    expect(lote.costeados).toHaveLength(50);
    lote.costeados.forEach((item) => expect(item).toMatchObject({
      productoId: referencias.unidad.id, cantidad: "1.000", precioUnitario: "1320.00", importe: "1320.00",
    }));
    expect(totalizarCotizacion({ items: lote.costeados, descuento: "0", tasaImpuesto: "15" }))
      .toMatchObject({ subtotal: "66000.00", impuesto: "9900.00", total: "75900.00" });
  });

  it("mantiene dos lecturas para 50 ítems con material y categoría repetidos", async () => {
    const uno = await medirCosteo([itemPersonalizado(referencias)]);
    const lote = await medirCosteo(Array.from({ length: 50 }, () => itemPersonalizado(referencias)));
    expect(uno.lecturas).toEqual([0, 0, 1, 0, 1, 0]);
    expect(lote.lecturas).toEqual(uno.lecturas);
    expect(lote.filtros[2]).toEqual([{ id: { in: [referencias.material.id] } }]);
    expect(lote.filtros[4]).toEqual([{ id: { in: [referencias.categoria.id] } }]);
    expect(lote.costeados).toHaveLength(50);
    lote.costeados.forEach((item) => {
      expect(item).toMatchObject({ costoTotal: "17980.80", margenPct: "35.00", importe: "27662.77" });
      expect(item.lineas.map((linea) => linea.importe)).toEqual(["15390.00", "600.00", "1990.80"]);
    });
    expect(totalizarCotizacion({ items: lote.costeados, descuento: "0", tasaImpuesto: "15" }))
      .toMatchObject({ subtotal: "1383138.50", impuesto: "207470.78", total: "1590609.28" });
  });

  it("omite las lecturas cuando no hay ítems", async () => {
    expect(await medirCosteo([])).toMatchObject({ costeados: [], lecturas: [0, 0, 0, 0, 0, 0] });
  });
});
