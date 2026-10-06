import { calcularConsumoEstimado, type ItemEstimable } from "@/core/consumo-estimado";
import { regla } from "./errores";
import type { CotizacionGuardada } from "./repo";

function itemEstimable(item: CotizacionGuardada["items"][number]): ItemEstimable {
  if (item.tipo === "PERSONALIZADO") return { secuencia: item.secuencia, tipo: "PERSONALIZADO",
    lineas: item.lineasCosto.filter((linea) => linea.tipo === "MATERIAL").map((linea) => ({
      secuencia: linea.secuencia, materialId: linea.materialId, unidad: linea.unidad,
      cantidad: linea.cantidad.toFixed(3), mermaPct: linea.mermaPct.toFixed(2),
    })) };
  if (!item.producto || item.producto.unidadCobro !== item.unidadCobro) {
    throw regla("RECETA_INCOMPATIBLE", `La unidad del producto del ítem ${item.secuencia} cambió. Revise la receta antes de convertir.`);
  }
  return { secuencia: item.secuencia, tipo: "CATALOGO", unidadCobro: item.unidadCobro,
    cantidad: item.cantidad.toFixed(3), ancho: item.ancho?.toFixed(3) ?? null, alto: item.alto?.toFixed(3) ?? null,
    receta: item.producto.receta.map((linea) => ({ materialId: linea.materialId, cantidad: linea.cantidad.toFixed(3) })) };
}

export function estimarCotizacion(cotizacion: CotizacionGuardada) {
  const materiales = cotizacion.items.flatMap((item) => item.lineasCosto.flatMap((linea) =>
    linea.material ? [[linea.material.id, linea.material.unidad]] : []));
  return calcularConsumoEstimado({ items: cotizacion.items.map(itemEstimable), unidadesMaterial: Object.fromEntries(materiales) });
}
