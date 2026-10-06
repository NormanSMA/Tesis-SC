import { cantidadConMerma, cantidadReceta, comparar, sumar } from "./calculos";
import type { CotizacionSembrada } from "./cotizaciones";
import type { ItemCalculado } from "./items";
import type { Catalogos } from "./tipos";

export type ConsumoEstimadoCalculado = {
  materialId: string;
  cantidad: string;
  origen: "RECETA" | "COTIZACION";
};

type Aporte = ConsumoEstimadoCalculado;

function aportesDeReceta(item: ItemCalculado, catalogos: Catalogos): Aporte[] {
  const receta = catalogos.recetas.get(item.productoCodigo ?? "") ?? [];
  return receta.map((linea) => ({
    materialId: linea.materialId,
    origen: "RECETA" as const,
    cantidad: cantidadReceta({
      cantidadPorUnidad: linea.cantidad,
      unidadCobro: item.unidadCobro,
      cantidad: item.cantidad,
      ancho: item.ancho,
      alto: item.alto,
    }),
  }));
}

function aportesDeLineas(item: ItemCalculado): Aporte[] {
  return item.lineas.flatMap((linea) =>
    linea.materialId
      ? [{ materialId: linea.materialId, origen: "COTIZACION" as const, cantidad: cantidadConMerma(linea) }]
      : [],
  );
}

// ConsumoEstimado es único por orden y material: se suman los aportes de recetas (catálogo) y de líneas MATERIAL.
export function calcularConsumoEstimado(
  cotizacion: CotizacionSembrada,
  catalogos: Catalogos,
): ConsumoEstimadoCalculado[] {
  const aportes = cotizacion.items.flatMap((item) =>
    item.tipo === "CATALOGO" ? aportesDeReceta(item, catalogos) : aportesDeLineas(item),
  );
  const porMaterial = new Map<string, Aporte[]>();
  for (const aporte of aportes) porMaterial.set(aporte.materialId, [...(porMaterial.get(aporte.materialId) ?? []), aporte]);
  return [...porMaterial].flatMap(([materialId, grupo]) => {
    const cantidad = sumar(grupo.map((a) => a.cantidad), 3);
    const origen = grupo.some((a) => a.origen === "RECETA") ? ("RECETA" as const) : ("COTIZACION" as const);
    return comparar(cantidad, 0) > 0 ? [{ materialId, cantidad, origen }] : [];
  });
}
