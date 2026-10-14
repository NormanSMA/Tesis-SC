import {
  costearItemCatalogo, costearItemPersonalizado, totalizarCotizacion,
  validarItemCatalogo, validarItemPersonalizado, validarCotizacion,
  type EntradaCotizacion, type EntradaLinea, type ItemCatalogoCosteado, type ItemPersonalizadoCosteado,
  type TotalesCotizacion,
} from "@/core/costeo";
import { CERO, CIEN, comparar, dividir, formatear, leerDecimal, multiplicar } from "@/core/decimal";
import type { CamposError } from "@/lib/errores";

import { aEntradaLinea, aLineaMotor } from "./mapeo";
import type { EntradaItem, EntradaLineaEditor } from "./schema";
import type { ItemDto, SelectoresEditor } from "./tipos";

export function aEntradaItem(item: ItemDto): EntradaItem {
  const base = { itemId: item.id, actualizarPrecio: false, cantidad: item.cantidad, ancho: item.ancho, alto: item.alto };
  if (item.tipo === "CATALOGO") return { ...base, tipo: item.tipo, productoId: item.productoId ?? "" };
  return { ...base, tipo: item.tipo, categoriaId: item.categoriaId, descripcion: item.descripcion,
    unidadCobro: item.unidadCobro, margenPct: item.margenPct ?? "0", lineas: item.lineas.map(aEntradaLinea) };
}

function lineaParaMotor(linea: EntradaLineaEditor, selectores: SelectoresEditor): EntradaLinea {
  if (linea.tipo !== "MATERIAL") return aLineaMotor(linea);
  const material = selectores.materiales.find((registro) => registro.id === linea.materialId);
  return aLineaMotor({ ...linea, costoUnitario: linea.costoUnitario ?? material?.costoPromedio ?? "" });
}

type ContextoItem = { item: EntradaItem; original?: ItemDto; selectores: SelectoresEditor };
export type ItemCalculado = ItemCatalogoCosteado | ItemPersonalizadoCosteado;

function calcularCatalogo({ item, original, selectores }: ContextoItem) {
  if (item.tipo !== "CATALOGO") throw new Error("El ítem debe ser de catálogo.");
  const producto = selectores.productos.find((registro) => registro.id === item.productoId);
  const conservar = original && !item.actualizarPrecio;
  const entrada = { cantidad: item.cantidad, ancho: item.ancho, alto: item.alto,
    unidadCobro: conservar ? original.unidadCobro : producto?.unidadCobro ?? "UNIDAD",
    precioBase: conservar ? original.precioUnitario : producto?.precioBase ?? "" };
  const errores = validarItemCatalogo(entrada);
  if (!conservar && !producto) errores.productoId = "Seleccione un producto activo.";
  return { errores, calculado: Object.keys(errores).length ? null : costearItemCatalogo(entrada) };
}

function calcularPersonalizado({ item, original, selectores }: ContextoItem) {
  if (item.tipo !== "PERSONALIZADO") throw new Error("El ítem debe ser personalizado.");
  const instantanea = original && !item.actualizarPrecio ? aEntradaItem(original) : item;
  if (instantanea.tipo !== "PERSONALIZADO") throw new Error("La instantánea debe ser personalizada.");
  const entrada = { cantidad: item.cantidad, margenPct: instantanea.margenPct,
    lineas: instantanea.lineas.map((linea) => lineaParaMotor(linea, selectores)) };
  const errores = validarItemPersonalizado(entrada);
  const medidas = validarItemCatalogo({ cantidad: item.cantidad, precioBase: "0",
    unidadCobro: item.unidadCobro, ancho: item.ancho, alto: item.alto });
  Object.assign(errores, medidas);
  return { errores, calculado: Object.keys(errores).length ? null : costearItemPersonalizado(entrada) };
}

/** descuento = round(subtotal × porcentaje / 100, 2) con aritmética decimal exacta. */
export function descuentoDePorcentaje(subtotal: string, porcentaje: string): string {
  const base = leerDecimal(subtotal);
  const pct = leerDecimal(porcentaje);
  if (!base || !pct) throw new Error("El subtotal y el porcentaje deben ser decimales con punto.");
  return formatear(dividir(multiplicar(base, pct), CIEN), 2);
}

// Mismo formato que acepta el servidor: 0 a 100 con hasta 2 decimales.
const PATRON_PORCENTAJE = /^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/;

/** Monto del descuento para un porcentaje escrito en el formulario. Nulo si el porcentaje no es válido. */
export function montoDePorcentajeEscrito(subtotal: string, porcentaje: string): string | null {
  return PATRON_PORCENTAJE.test(porcentaje) ? descuentoDePorcentaje(subtotal, porcentaje) : null;
}

/** Porcentaje equivalente (2 decimales) de un monto escrito. Nulo si el monto no es decimal. Subtotal cero da "0.00". */
export function porcentajeDeMonto(subtotal: string, monto: string): string | null {
  const base = leerDecimal(subtotal);
  const valor = leerDecimal(monto);
  if (!base || !valor) return null;
  if (comparar(base, CERO) === 0) return "0.00";
  return formatear(multiplicar(dividir(valor, base), CIEN), 2);
}

export type ModoDescuento = "MONTO" | "PORCENTAJE";

/** Campo de descuento del cuerpo de guardado: el servidor admite monto o porcentaje, nunca ambos. */
export function descuentoParaGuardar(modo: ModoDescuento, monto: string, porcentaje: string) {
  return modo === "PORCENTAJE" ? { descuentoPct: porcentaje.trim() } : { descuento: monto };
}

/** Totales de la cotización. Con porcentaje, el monto del descuento sale del subtotal vigente. */
export function totalizarConDescuento(entrada: EntradaCotizacion & { descuentoPct: string | null }): TotalesCotizacion {
  const { descuentoPct, ...base } = entrada;
  if (descuentoPct === null) return totalizarCotizacion(base);
  const { subtotal } = totalizarCotizacion({ ...base, descuento: "0" });
  return totalizarCotizacion({ ...base, descuento: descuentoDePorcentaje(subtotal, descuentoPct) });
}

type EntradaVista ={ items: EntradaItem[]; originales: ItemDto[]; selectores: SelectoresEditor;
  descuento: string; descuentoPct?: string | null; tasaImpuesto: string };

export function calcularVista(entrada: EntradaVista) {
  const errores: CamposError = {};
  const items = entrada.items.map((item, indice) => {
    const contexto = { item, original: entrada.originales.find((registro) => registro.id === item.itemId),
      selectores: entrada.selectores };
    const resultado = item.tipo === "CATALOGO" ? calcularCatalogo(contexto) : calcularPersonalizado(contexto);
    for (const [campo, mensaje] of Object.entries(resultado.errores)) errores[`items.${indice}.${campo}`] = mensaje;
    return resultado.calculado;
  });
  if (items.some((item) => item === null)) return { items, errores, totales: null };
  const cotizacion = { items: items.filter((item): item is ItemCalculado => item !== null),
    descuento: entrada.descuento, tasaImpuesto: entrada.tasaImpuesto };
  if (entrada.descuentoPct != null && !Object.keys(validarCotizacion({ ...cotizacion, descuento: "0" })).length) {
    const monto = montoDePorcentajeEscrito(totalizarCotizacion({ ...cotizacion, descuento: "0" }).subtotal, entrada.descuentoPct);
    if (monto === null) errores.descuentoPct = "Ingrese un porcentaje de 0 a 100 con hasta 2 decimales.";
    else cotizacion.descuento = monto;
  }
  Object.assign(errores, validarCotizacion(cotizacion));
  return { items, errores, totales: Object.keys(errores).length ? null : totalizarCotizacion(cotizacion) };
}
