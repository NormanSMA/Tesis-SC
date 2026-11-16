import { tieneGastosFijos } from "@/modules/personalizadas/gastos-schema";
import { gastosCalculados } from "@/modules/personalizadas/gastos-calculo";
import { validarDescuentoGastos, LIMITE_DESCUENTO_GASTOS } from "@/modules/personalizadas/descuentos";
import {
  costearItemCatalogo, costearItemPersonalizado, totalizarCotizacion,
  validarItemCatalogo, validarItemPersonalizado, validarCotizacion,
  type EntradaCotizacion, type EntradaLinea, type ItemCatalogoCosteado, type ItemPersonalizadoCosteado,
  type TotalesCotizacion,
} from "@/core/costeo";
import { CERO, CIEN, comparar, dividir, formatear, leerDecimal, multiplicar } from "@/core/decimal";
import type { CamposError } from "@/lib/errores";

import { aEntradaLinea, aLineaMotor } from "./mapeo";
import { MENSAJE_AREA_MATERIAL, modalidadMaterial, superficieTotal } from "./materiales";
import type { EntradaItem, EntradaLineaEditor } from "./schema";
import type { ItemDto, SelectoresEditor } from "./tipos";

export function aEntradaItem(item: ItemDto): EntradaItem {
  const base = { itemId: item.id, actualizarPrecio: false, cantidad: item.cantidad, ancho: item.ancho, alto: item.alto,
    profundidad: item.profundidad };
  if (item.tipo === "CATALOGO") return { ...base, tipo: item.tipo, productoId: item.productoId ?? "" };
  return { ...base, tipo: item.tipo, categoriaId: item.categoriaId, descripcion: item.descripcion,
    unidadCobro: item.unidadCobro, margenPct: item.margenPct ?? "0", ...(item.productoPersonalizado ? { productoPersonalizado: item.productoPersonalizado } : {}), ...(item.gastosPersonalizados ? { gastosPersonalizados: item.gastosPersonalizados } : {}), lineas: item.lineas.map(aEntradaLinea) };
}

function lineaParaMotor(linea: EntradaLineaEditor, selectores: SelectoresEditor,
  { area, actualizar }: { area: string | null; actualizar: boolean }): EntradaLinea {
  if (linea.tipo !== "MATERIAL") return aLineaMotor(linea);
  const material = selectores.materiales.find((registro) => registro.id === linea.materialId);
  return aLineaMotor({ ...linea, cantidad: area ?? linea.cantidad,
    costoUnitario: (actualizar ? undefined : linea.costoUnitario) ?? material?.precioCotizacion ?? material?.costoPromedio ?? "" });
}

type ContextoItem = { item: EntradaItem; original?: ItemDto; selectores: SelectoresEditor };
export type ItemCalculado = ItemCatalogoCosteado | ItemPersonalizadoCosteado;

function calcularCatalogo({ item, original, selectores }: ContextoItem) {
  if (item.tipo !== "CATALOGO") throw new Error("El producto debe ser de catálogo.");
  const producto = selectores.productos.find((registro) => registro.id === item.productoId);
  const conservar = original && !item.actualizarPrecio;
  const entrada = { cantidad: item.cantidad, ancho: item.ancho, alto: item.alto, profundidad: item.profundidad,
    unidadCobro: conservar ? original.unidadCobro : producto?.unidadCobro ?? "UNIDAD",
    precioBase: conservar ? original.precioUnitario : producto?.precioBase ?? "" };
  const errores = validarItemCatalogo(entrada);
  if (!conservar && !producto) errores.productoId = "Seleccione un producto activo.";
  return { errores, calculado: Object.keys(errores).length ? null : costearItemCatalogo(entrada) };
}

function calcularPersonalizado({ item, original, selectores }: ContextoItem) {
  if (item.tipo !== "PERSONALIZADO") throw new Error("El producto debe ser personalizado.");
  const instantanea = original && !item.actualizarPrecio ? aEntradaItem(original) : item;
  if (instantanea.tipo !== "PERSONALIZADO") throw new Error("La instantánea debe ser personalizada.");
  const modalidades = instantanea.lineas.filter(l => !l.esGastoPersonalizado).map((linea) => {
    if (linea.tipo !== "MATERIAL" || !linea.materialId) return "CANTIDAD";
    const guardada = original?.lineas.find(({ id, materialId }) => id === linea.lineaId && materialId === linea.materialId);
    const material = selectores.materiales.find(({ id }) => id === linea.materialId);
    if (guardada && (!item.actualizarPrecio || !material)) return guardada.cantidadPorArea ? "AREA" : "CANTIDAD";
    return modalidadMaterial(material,
      item.unidadCobro === "M2" || Boolean(item.ancho && item.alto));
  });
  const porArea = modalidades.map((modo) => modo !== "CANTIDAD");
  const area = superficieTotal(item);
  const entrada = { cantidad: item.cantidad, margenPct: instantanea.margenPct,
    lineas: instantanea.lineas.filter(l => !l.esGastoPersonalizado).map((linea, indice) => lineaParaMotor(linea, selectores, {
      area: porArea[indice] ? area : null,
      actualizar: Boolean(item.actualizarPrecio && linea.tipo === "MATERIAL" &&
        selectores.materiales.some(({ id }) => id === linea.materialId)),
    })) };
  const errores = validarItemPersonalizado(entrada);
  if (!entrada.lineas.length && tieneGastosFijos(instantanea.gastosPersonalizados)) delete errores.lineas;
  modalidades.forEach((modo, indice) => {
    if (modo === "FALTA_AREA") errores[`lineas.${indice}.materialId`] = MENSAJE_AREA_MATERIAL;
  });
  const medidas = validarItemCatalogo({ cantidad: item.cantidad, precioBase: "0",
    unidadCobro: porArea.some(Boolean) ? "M2" : item.unidadCobro, ancho: item.ancho, alto: item.alto, profundidad: item.profundidad });
  if (porArea.some(Boolean) && !area) medidas.ancho ??= "Indique medidas que produzcan un área mayor que cero.";
  Object.assign(errores, medidas);
  if (!Object.keys(errores).length && instantanea.gastosPersonalizados) {
    try {
      entrada.lineas.push(...gastosCalculados({ ...entrada, gastos: instantanea.gastosPersonalizados }).map(f => ({ tipo: "TERCERO" as const, costo: f.costo })));
    } catch (e) { errores.gastosPersonalizados = e instanceof Error ? e.message : "Revise los gastos."; }
  }
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
  validarDescuentoGastos(entrada);
  const { descuentoPct, ...base } = entrada;
  if (descuentoPct === null) return totalizarCotizacion(base);
  const { subtotal } = totalizarCotizacion({ ...base, descuento: "0" });
  return totalizarCotizacion({ ...base, descuento: descuentoDePorcentaje(subtotal, descuentoPct) });
}

type EntradaVista ={ items: EntradaItem[]; originales: ItemDto[]; selectores: SelectoresEditor;
  descuento: string; descuentoPct?: string | null; tasaImpuesto: string };

export function calcularVista(entrada: EntradaVista) {
  const errores: CamposError = {};
  const vigentes = entrada.items.map(i => entrada.originales.find(o => o.id === i.itemId && !i.actualizarPrecio) ?? i);
  try { validarDescuentoGastos({ ...entrada, items: vigentes }); }
  catch { errores.descuento = LIMITE_DESCUENTO_GASTOS; }
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
