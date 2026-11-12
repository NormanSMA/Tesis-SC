import { dividir, formatear, leerDecimal, multiplicar } from "@/core/decimal";

export const MENSAJE_AREA_MATERIAL = "Configure en Inventario el área de la lámina, pliego o rollo completo para cotizar este material en m².";
export const MENSAJE_TARIFA_MATERIAL = "Tarifa pendiente. Configure un precio en Configuración → Tarifas y actualice el costo de la partida.";

export function faltaTarifaMaterial(costo: string | null | undefined) {
  const precio = costo ? leerDecimal(costo) : null;
  return !precio || precio.num <= BigInt(0);
}

export function modalidadMaterial(material: { unidad: string; unidadCotizacion?: string | null } | undefined, conMedidas: boolean) {
  if (material?.unidadCotizacion === "M2" || (conMedidas && material?.unidad === "M2")) return "AREA";
  if (conMedidas && material && !material.unidadCotizacion && ["PLIEGO", "ROLLO"].includes(material.unidad)) return "FALTA_AREA";
  return "CANTIDAD";
}

export function superficieTotal({ ancho, alto, cantidad }: { ancho?: string | null; alto?: string | null; cantidad: string }): string | null {
  const medidas = [ancho, alto, cantidad].map((valor) => valor ? leerDecimal(valor) : null);
  const [a, b, piezas] = medidas;
  if (!a || !b || !piezas || medidas.some((valor) => valor!.num <= BigInt(0))) return null;
  const superficie = formatear(multiplicar(multiplicar(a, b), piezas), 3);
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
