// Previsión de materiales de una orden a partir de una cotización aprobada (CF-01, R-04).
// Pura: sin base de datos. Mismos redondeos que el motor de costeo y que la siembra.
import { CERO, CIEN, UNO, comparar, dividir, formatear, leerDecimal, multiplicar, redondear, sumar, type Racional } from "./decimal";

export type OrigenEstimado = "RECETA" | "COTIZACION";

export type LineaReceta = { materialId: string; cantidad: string };
export type LineaMaterial = {
  secuencia: number; materialId: string | null; unidad: string; cantidad: string; mermaPct: string;
};

export type ItemEstimable =
  | { secuencia: number; tipo: "CATALOGO"; unidadCobro: "UNIDAD" | "M2"; cantidad: string;
      ancho: string | null; alto: string | null; receta: LineaReceta[] }
  | { secuencia: number; tipo: "PERSONALIZADO"; lineas: LineaMaterial[] };

export type EntradaEstimado = { items: ItemEstimable[]; unidadesMaterial: Record<string, string> };
export type ConsumoEstimado = { materialId: string; cantidad: string; origen: OrigenEstimado };
export type AdvertenciaEstimado = { itemSecuencia: number; lineaSecuencia: number; mensaje: string };
export type ResultadoEstimado = { consumos: ConsumoEstimado[]; advertencias: AdvertenciaEstimado[] };

type Aporte = { materialId: string; cantidad: Racional; origen: OrigenEstimado };

function leer(texto: string): Racional {
  const valor = leerDecimal(texto);
  if (!valor) throw new Error(`Cantidad no decimal: ${texto}`);
  return valor;
}

// La unidad de una línea es texto libre; la del material es un enum. Se comparan sin mayúsculas, sin "²" y sin plural.
export function normalizarUnidad(texto: string): string {
  const base = texto.trim().toLowerCase().replace("²", "2");
  return base.length > 2 && base.endsWith("s") ? base.slice(0, -1) : base;
}

function aporteReceta(item: Extract<ItemEstimable, { tipo: "CATALOGO" }>, linea: LineaReceta): Aporte {
  const base = multiplicar(leer(linea.cantidad), redondear(leer(item.cantidad), 3));
  if (item.unidadCobro === "UNIDAD") {
    return { materialId: linea.materialId, cantidad: redondear(base, 3), origen: "RECETA" };
  }
  if (item.ancho === null || item.alto === null) throw new Error("El cobro por m2 exige ancho y alto");
  const area = multiplicar(redondear(leer(item.ancho), 3), redondear(leer(item.alto), 3));
  return { materialId: linea.materialId, cantidad: redondear(multiplicar(base, area), 3), origen: "RECETA" };
}

function cantidadConMerma(linea: LineaMaterial): Racional {
  const factor = sumar(UNO, dividir(redondear(leer(linea.mermaPct), 2), CIEN));
  return redondear(multiplicar(redondear(leer(linea.cantidad), 3), factor), 3);
}

function aportesPersonalizado(
  item: Extract<ItemEstimable, { tipo: "PERSONALIZADO" }>,
  unidadesMaterial: Record<string, string>,
): { aportes: Aporte[]; advertencias: AdvertenciaEstimado[] } {
  const aportes: Aporte[] = [];
  const advertencias: AdvertenciaEstimado[] = [];
  for (const linea of item.lineas) {
    if (!linea.materialId) continue;
    const unidadMaterial = unidadesMaterial[linea.materialId];
    if (!unidadMaterial || normalizarUnidad(unidadMaterial) !== normalizarUnidad(linea.unidad)) {
      advertencias.push({ itemSecuencia: item.secuencia, lineaSecuencia: linea.secuencia,
        mensaje: `Línea ${linea.secuencia} del ítem ${item.secuencia}: la unidad "${linea.unidad}" no coincide con la del material; no se estimó.` });
      continue;
    }
    aportes.push({ materialId: linea.materialId, cantidad: cantidadConMerma(linea), origen: "COTIZACION" });
  }
  return { aportes, advertencias };
}

function agrupar(aportes: Aporte[]): ConsumoEstimado[] {
  const porMaterial = new Map<string, Aporte[]>();
  for (const aporte of aportes) porMaterial.set(aporte.materialId, [...(porMaterial.get(aporte.materialId) ?? []), aporte]);
  return [...porMaterial].flatMap(([materialId, grupo]) => {
    const total = redondear(grupo.reduce((suma, aporte) => sumar(suma, aporte.cantidad), CERO), 3);
    if (comparar(total, CERO) <= 0) return [];
    const origen: OrigenEstimado = grupo.some((aporte) => aporte.origen === "RECETA") ? "RECETA" : "COTIZACION";
    return [{ materialId, cantidad: formatear(total, 3), origen }];
  });
}

// ConsumoEstimado es único por orden y material: se suman los aportes de recetas y de líneas MATERIAL.
export function calcularConsumoEstimado(entrada: EntradaEstimado): ResultadoEstimado {
  const aportes: Aporte[] = [];
  const advertencias: AdvertenciaEstimado[] = [];
  for (const item of entrada.items) {
    if (item.tipo === "CATALOGO") {
      aportes.push(...item.receta.map((linea) => aporteReceta(item, linea)));
      continue;
    }
    const resultado = aportesPersonalizado(item, entrada.unidadesMaterial);
    aportes.push(...resultado.aportes);
    advertencias.push(...resultado.advertencias);
  }
  const consumos = agrupar(aportes).sort((a, b) => a.materialId.localeCompare(b.materialId));
  return { consumos, advertencias };
}
