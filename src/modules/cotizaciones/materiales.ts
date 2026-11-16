import { dividir, formatear, leerDecimal, multiplicar } from "@/core/decimal";
import { superficiePieza } from "@/core/medidas";

export const MENSAJE_AREA_MATERIAL = "Configure en Inventario el área de la lámina, pliego o rollo completo para cotizar este material en m².";
export const MENSAJE_TARIFA_MATERIAL = "Tarifa pendiente. Configure un precio en Configuración → Tarifas y actualice el costo de el trabajo.";

export function faltaTarifaMaterial(costo: string | null | undefined) {
  const precio = costo ? leerDecimal(costo) : null;
  return !precio || precio.num <= BigInt(0);
}

export function modalidadMaterial(material: { unidad: string; unidadCotizacion?: string | null } | undefined, conMedidas: boolean) {
  if (material?.unidadCotizacion === "M2" || (conMedidas && material?.unidad === "M2")) return "AREA";
  if (conMedidas && material && !material.unidadCotizacion && ["PLIEGO", "ROLLO"].includes(material.unidad)) return "FALTA_AREA";
  return "CANTIDAD";
}

export function superficieTotal({ ancho, alto, profundidad, cantidad }: {
  ancho?: string | null; alto?: string | null; profundidad?: string | null; cantidad: string;
}): string | null {
  const medidas = [ancho, alto, cantidad].map((valor) => valor ? leerDecimal(valor) : null);
  const [a, b, piezas] = medidas;
  if (!a || !b || !piezas || medidas.some((valor) => valor!.num <= BigInt(0))) return null;
  const p = profundidad ? leerDecimal(profundidad) : null;
  const superficie = formatear(multiplicar(superficiePieza(a, b, p && p.num > BigInt(0) ? p : null), piezas), 3);
  return Number(superficie) > 0 ? superficie : null;
}

export function precioParaCotizar(material: {
  precioCotizacion: { toString(): string } | null; costoPromedio: { toString(): string };
  areaUnidadInventario: { toString(): string } | null;
}) {
  if (material.precioCotizacion) return material.precioCotizacion.toString();
  const costo = material.costoPromedio.toString();
  return material.areaUnidadInventario ? formatear(dividir(leerDecimal(costo)!,
    leerDecimal(material.areaUnidadInventario.toString())!), 4) : costo;
}
