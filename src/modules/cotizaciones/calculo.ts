import {
  costearItemCatalogo, costearItemPersonalizado, totalizarCotizacion,
  validarItemCatalogo, validarItemPersonalizado, validarCotizacion,
  type EntradaLinea, type ItemCatalogoCosteado, type ItemPersonalizadoCosteado,
} from "@/core/costeo";
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

type EntradaVista = { items: EntradaItem[]; originales: ItemDto[]; selectores: SelectoresEditor;
  descuento: string; tasaImpuesto: string };

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
  Object.assign(errores, validarCotizacion(cotizacion));
  return { items, errores, totales: Object.keys(errores).length ? null : totalizarCotizacion(cotizacion) };
}
