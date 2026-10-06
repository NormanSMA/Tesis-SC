// Reglas puras del consumo y la devolución por orden (docs/modulos/05-inventario.md). Sin base de datos.
import { CERO, comparar, formatear, leerDecimal, restar, type Racional } from "@/core/decimal";
import { AppError } from "@/lib/errores";
import type { EntradaMovimientosOrden } from "./contrato-orden";

export type OperacionLibro = "consumo" | "devolucion";

/** Línea lista para bloquear: id en minúsculas, cantidad con 3 decimales e índice original para los errores. */
export type LineaNormalizada = { indice: number; materialId: string; cantidad: string };

const ADMITE_CONSUMO = ["PENDIENTE", "EN_PRODUCCION", "LISTA"];
// Ampliación de I-22: se devuelve el sobrante de una orden entregada o cancelada, nunca de una cerrada.
const ADMITE_DEVOLUCION = ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CANCELADA"];

export function admiteOperacion(operacion: OperacionLibro, estado: string): boolean {
  return (operacion === "consumo" ? ADMITE_CONSUMO : ADMITE_DEVOLUCION).includes(estado);
}

export function leerCantidad(texto: string): Racional {
  const valor = leerDecimal(texto);
  if (!valor) throw new Error(`Cantidad no decimal: ${texto}`);
  return valor;
}

export function cantidad3(valor: Racional | string): string {
  return formatear(typeof valor === "string" ? leerCantidad(valor) : valor, 3);
}

/**
 * Ordena por materialId con comparación de cadenas simple (no localeCompare): todas las solicitudes
 * bloquean los materiales en el mismo orden y no se forman ciclos (I-24). Las minúsculas evitan que el
 * mismo UUID escrito en mayúsculas cambie el orden o se cuele como material repetido.
 */
export function normalizarLineas(entrada: EntradaMovimientosOrden): LineaNormalizada[] {
  const lineas = entrada.lineas.map((linea, indice) => ({
    indice, materialId: linea.materialId.toLowerCase(), cantidad: cantidad3(linea.cantidad),
  }));
  const campos: Record<string, string> = {};
  const vistos = new Set<string>();
  for (const linea of lineas) {
    if (vistos.has(linea.materialId)) campos[`lineas.${linea.indice}.materialId`] = "El material está repetido.";
    vistos.add(linea.materialId);
  }
  if (Object.keys(campos).length) {
    throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.", campos });
  }
  return lineas.sort((a, b) => (a.materialId < b.materialId ? -1 : a.materialId > b.materialId ? 1 : 0));
}

/** El libro guarda el CONSUMO con cantidad negativa; la API siempre recibe y devuelve cantidades positivas. */
export function cantidadConSigno(operacion: OperacionLibro, cantidad: string): string {
  return operacion === "consumo" ? `-${cantidad}` : cantidad;
}

export type TotalesMaterial = { estimado: string | null; consumido: string; devuelto: string };

/**
 * Neto = consumido menos devuelto. Excede si el neto supera el estimado o si hay neto sin estimado:
 * se compara el neto y no el bruto, porque retirar, devolver y volver a retirar no es un exceso.
 */
export function resumirTotales(totales: TotalesMaterial) {
  const neto = restar(leerCantidad(totales.consumido), leerCantidad(totales.devuelto));
  const estimado = totales.estimado === null ? CERO : leerCantidad(totales.estimado);
  return {
    estimado: cantidad3(estimado), consumido: cantidad3(totales.consumido), devuelto: cantidad3(totales.devuelto),
    neto: cantidad3(neto), excedeEstimado: comparar(neto, estimado) > 0,
  };
}
