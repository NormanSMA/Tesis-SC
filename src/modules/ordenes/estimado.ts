import { calcularConsumoEstimado, type ItemEstimable } from "@/core/consumo-estimado";
import { regla } from "./errores";
import type { CotizacionGuardada } from "./repo";

function itemEstimable(item: CotizacionGuardada["items"][number]): ItemEstimable {
  if (item.tipo === "PERSONALIZADO") return { secuencia: item.secuencia, tipo: "PERSONALIZADO",
    lineas: item.lineasCosto.filter((linea) => linea.tipo === "MATERIAL").map((linea) => ({
      secuencia: linea.secuencia, materialId: linea.materialId, unidad: linea.unidad,
      cantidad: linea.cantidad.toFixed(3), mermaPct: linea.mermaPct.toFixed(2),
      areaUnidadInventario: linea.areaUnidadInventario?.toFixed(6) ?? null,
    })) };
  if (!item.producto || item.producto.unidadCobro !== item.unidadCobro) {
    throw regla("RECETA_INCOMPATIBLE", `La unidad del producto del ítem ${item.secuencia} cambió. Revise los materiales del producto antes de convertir.`);
  }
  return { secuencia: item.secuencia, tipo: "CATALOGO", unidadCobro: item.unidadCobro,
    cantidad: item.cantidad.toFixed(3), ancho: item.ancho?.toFixed(3) ?? null, alto: item.alto?.toFixed(3) ?? null,
    receta: item.producto.receta.map((linea) => ({ materialId: linea.materialId, cantidad: linea.cantidad.toFixed(3) })) };
}

export function estimarCotizacion(cotizacion: CotizacionGuardada) {
  const materiales = cotizacion.items.flatMap((item) => [
    ...item.lineasCosto.flatMap(({ material }) => material ? [material] : []),
    ...(item.producto?.receta.map(({ material }) => material) ?? []),
  ]);
  const unidadesMaterial = Object.fromEntries(materiales.map(({ id, unidad }) => [id, unidad]));
  const areas = new Map(materiales.map(({ id, areaProduccion }) => [id, areaProduccion]));
  const estimado = calcularConsumoEstimado({ items: cotizacion.items.map(itemEstimable), unidadesMaterial });
  return { ...estimado, consumos: estimado.consumos.map((consumo) =>
    ({ ...consumo, areaProduccion: areas.get(consumo.materialId) ?? null })) };
}
