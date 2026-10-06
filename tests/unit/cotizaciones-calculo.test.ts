import { describe, expect, it } from "vitest";
import { costearItemCatalogo, costearItemPersonalizado, totalizarCotizacion } from "@/core/costeo";
import { aEntradaItem, calcularVista } from "@/modules/cotizaciones/calculo";
import { aEntradaLinea, aLineaMotor } from "@/modules/cotizaciones/mapeo";
import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { ItemDto, SelectoresEditor } from "@/modules/cotizaciones/tipos";

const selectores: SelectoresEditor = {
  productos: [
    { id: "p1", codigo: "U", nombre: "Unidad", categoriaId: "c", categoria: "Rotulación", unidadCobro: "UNIDAD", precioBase: "100" },
    { id: "p2", codigo: "M", nombre: "Superficie", categoriaId: "c", categoria: "Rotulación", unidadCobro: "M2", precioBase: "250" },
  ],
  materiales: [{ id: "m1", codigo: "V", nombre: "Vinil", unidad: "M2", costoPromedio: "150" }],
  categorias: [{ id: "c", nombre: "Rotulación" }],
};
const personalizado: EntradaItem & { tipo: "PERSONALIZADO" } = {
  tipo: "PERSONALIZADO", categoriaId: "c", descripcion: "Personalizado", unidadCobro: "UNIDAD", cantidad: "2", margenPct: "35",
  lineas: [
    { tipo: "MATERIAL", descripcion: "Material", unidad: "m2", materialId: "m1", cantidad: "2", mermaPct: "5" },
    { tipo: "MANO_OBRA", descripcion: "Diseño", unidad: "h", horas: "3", tarifa: "100" },
    { tipo: "TERCERO", descripcion: "Traslado", unidad: "servicio", costo: "20" },
  ],
};
const baseItem: ItemDto = {
  id: "i1", secuencia: 1, tipo: "CATALOGO", productoId: "p1", categoriaId: "c", descripcion: "Unidad guardada",
  unidadCobro: "UNIDAD", cantidad: "2.000", ancho: null, alto: null, precioUnitario: "80.00",
  costoTotal: null, margenPct: null, importe: "160.00", lineas: [], productoActivo: true,
};

function vista(items: EntradaItem[], originales: ItemDto[] = []) {
  return calcularVista({ items, originales, selectores, descuento: "0", tasaImpuesto: "15" });
}

describe("cotizaciones: mapeo del editor al motor", () => {
  it("mapea DTO conservando identidad y entradas de cada clase de línea", () => {
    const lineas = [
      { id: "l1", secuencia: 1, tipo: "MATERIAL" as const, descripcion: "Vinil", unidad: "m2", materialId: "m1", cantidad: "5.000", costoUnitario: "10.0000", mermaPct: "8.00", importe: "54.00" },
      { id: "l2", secuencia: 2, tipo: "MANO_OBRA" as const, descripcion: "Diseño", unidad: "h", materialId: null, cantidad: "4.000", costoUnitario: "15.0000", mermaPct: "0.00", importe: "60.00" },
      { id: "l3", secuencia: 3, tipo: "TERCERO" as const, descripcion: "Traslado", unidad: "servicio", materialId: null, cantidad: "1.000", costoUnitario: "20.0000", mermaPct: "0.00", importe: "20.00" },
    ];
    const entrada = aEntradaItem({ ...baseItem, tipo: "PERSONALIZADO", productoId: null, costoTotal: "134.00", margenPct: "35.00", lineas });
    expect(entrada.itemId).toBe("i1");
    expect(entrada.tipo === "PERSONALIZADO" && entrada.lineas.map(aLineaMotor)).toEqual([
      { tipo: "MATERIAL", cantidad: "5.000", costoUnitario: "10.0000", mermaPct: "8.00" },
      { tipo: "MANO_OBRA", horas: "4.000", tarifa: "15.0000" }, { tipo: "TERCERO", costo: "20.0000" },
    ]);
    expect(aEntradaLinea(lineas[0]).lineaId).toBe("l1");
  });

  it("calcula los tres tipos de ítem con las funciones puras", () => {
    const items: EntradaItem[] = [
      { tipo: "CATALOGO", productoId: "p1", cantidad: "3" },
      { tipo: "CATALOGO", productoId: "p2", cantidad: "2", ancho: "0.333", alto: "0.777" }, personalizado,
    ];
    const esperados = [costearItemCatalogo({ unidadCobro: "UNIDAD", precioBase: "100", cantidad: "3" }),
      costearItemCatalogo({ unidadCobro: "M2", precioBase: "250", cantidad: "2", ancho: "0.333", alto: "0.777" }),
      costearItemPersonalizado({ cantidad: "2", margenPct: "35", lineas: [
        { tipo: "MATERIAL", cantidad: "2", costoUnitario: "150", mermaPct: "5" },
        { tipo: "MANO_OBRA", horas: "3", tarifa: "100" }, { tipo: "TERCERO", costo: "20" },
      ] })];
    expect(vista(items).items).toEqual(esperados);
    expect(vista(items).totales).toEqual(totalizarCotizacion({ items: esperados, descuento: "0", tasaImpuesto: "15" }));
  });

  it("conserva precio del catálogo aunque cambie su selector", () => {
    const calculado = vista([aEntradaItem(baseItem)], [baseItem]);
    expect(calculado.items[0]).toMatchObject({ precioUnitario: "80.00", importe: "160.00" });
    expect(vista([{ ...aEntradaItem(baseItem), actualizarPrecio: true }], [baseItem]).items[0])
      .toMatchObject({ precioUnitario: "100.00", importe: "200.00" });
  });

  it("conserva producto archivado y exige selector activo al actualizar precio", () => {
    const archivado = { ...baseItem, productoId: "archivado", productoActivo: false };
    expect(vista([aEntradaItem(archivado)], [archivado]).totales?.subtotal).toBe("160.00");
    expect(vista([{ ...aEntradaItem(archivado), actualizarPrecio: true }], [archivado]).errores["items.0.productoId"]).toBeTruthy();
  });

  it("conserva costos y margen personalizados salvo actualización explícita", () => {
    const original: ItemDto = { ...baseItem, tipo: "PERSONALIZADO", productoId: null, costoTotal: "20.00", margenPct: "50.00", importe: "40.00",
      lineas: [{ id: "l3", secuencia: 1, tipo: "TERCERO", descripcion: "Tercero", unidad: "servicio", materialId: null,
        cantidad: "1.000", costoUnitario: "20.0000", mermaPct: "0.00", importe: "20.00" }] };
    const cambiado = { ...personalizado, itemId: original.id, margenPct: "20" };
    expect(vista([cambiado], [original]).items[0]).toMatchObject({ costoTotal: "20.00", margenPct: "50.00", importe: "40.00" });
    expect(vista([{ ...cambiado, actualizarPrecio: true }], [original]).items[0])
      .toMatchObject({ costoTotal: "635.00", margenPct: "20.00", importe: "793.75" });
  });

  it("cantidad personalizada divide precio unitario sin multiplicar consumos", () => {
    const uno = vista([{ ...personalizado, cantidad: "1" }]).items[0];
    const dos = vista([{ ...personalizado, cantidad: "2" }]).items[0];
    expect(uno?.importe).toBe(dos?.importe);
    expect(uno?.costoTotal).toBe(dos?.costoTotal);
    expect(uno?.precioUnitario).toBe("976.92");
    expect(dos?.precioUnitario).toBe("488.46");
  });

  it("prefija errores por ítem y línea, incluyendo medidas M2", () => {
    const errores = vista([{ tipo: "CATALOGO", productoId: "p2", cantidad: "2" },
      { ...personalizado, lineas: [{ tipo: "MANO_OBRA", descripcion: "Diseño", unidad: "h", horas: "0", tarifa: "100" }] }]).errores;
    expect(Object.keys(errores)).toEqual(expect.arrayContaining(["items.0.ancho", "items.0.alto", "items.1.lineas.0.horas"]));
    expect(vista([{ ...personalizado, unidadCobro: "M2" }]).errores["items.0.ancho"]).toBeTruthy();
  });

  it("rechaza descuento superior al subtotal en la vista", () => {
    expect(calcularVista({ items: [], originales: [], selectores, descuento: "1", tasaImpuesto: "15" }).errores.descuento).toBeTruthy();
  });
});
