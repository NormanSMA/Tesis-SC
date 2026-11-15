import { esquemaSeleccionProducto, type SeleccionProducto } from "@/modules/personalizadas/seleccion-schema";
import { gastosCalculados } from "@/modules/personalizadas/gastos-calculo";
import { esquemaGastos, type GastosPersonalizados } from "@/modules/personalizadas/gastos-schema";
import { randomUUID } from "node:crypto";
import { costearItemCatalogo, costearItemPersonalizado, validarItemCatalogo } from "@/core/costeo";
import { convertirDesdeCordobas } from "@/core/moneda";
import type { Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { aLineaDto } from "./dto";
import { prefijarError, regla } from "./errores";
import { aEntradaLinea, aLineaMotor } from "./mapeo";
import { MENSAJE_AREA_MATERIAL, modalidadMaterial, precioParaCotizar, superficieTotal } from "./materiales";
import type { ItemGuardado } from "./repo";
import type { EntradaItem, EntradaLineaEditor } from "./schema";

type LineaCalculada = {
  esGastoPersonalizado?: boolean;
  id: string; secuencia: number; tipo: "MATERIAL" | "MANO_OBRA" | "TERCERO";
  descripcion: string; materialId: string | null; unidad: string;
  cantidad: string; costoUnitario: string; mermaPct: string; importe: string;
  cantidadPorArea?: boolean; areaUnidadInventario?: string | null;
};
export type ItemCalculado = {
  productoPersonalizado?: SeleccionProducto;
  gastosPersonalizados?: GastosPersonalizados;
  id: string; secuencia: number; tipo: "CATALOGO" | "PERSONALIZADO"; productoId: string | null;
  categoriaId: string; descripcion: string; unidadCobro: "UNIDAD" | "M2";
  cantidad: string; ancho: string | null; alto: string | null; profundidad: string | null; precioUnitario: string;
  costoTotal: string | null; margenPct: string | null; importe: string; lineas: LineaCalculada[];
};
type ReferenciasCosteo = Awaited<ReturnType<typeof cargarReferencias>>;
type ContextoItem = { referencias: ReferenciasCosteo; entrada: EntradaItem; anterior?: ItemGuardado; secuencia: number; tipoCambio: string; duplicando?: boolean };

async function cargarReferencias(tx: Tx, items: EntradaItem[], anteriores: Map<string, ItemGuardado>) {
  const productoIds = new Set<string>();
  const materialIds = new Set<string>();
  const categoriaIds = new Set<string>();
  for (const entrada of items) {
    const anterior = entrada.itemId ? anteriores.get(entrada.itemId) : undefined;
    if (entrada.tipo === "CATALOGO") {
      if (!anterior || entrada.actualizarPrecio) productoIds.add(entrada.productoId);
      continue;
    }
    categoriaIds.add(entrada.categoriaId);
    if (anterior && !entrada.actualizarPrecio) continue;
    for (const linea of entrada.lineas) {
      if (linea.tipo === "MATERIAL" && linea.materialId) materialIds.add(linea.materialId);
    }
  }
  const [productos, materiales, categorias] = await Promise.all([
    productoIds.size ? tx.producto.findMany({ where: { id: { in: [...productoIds] } } }) : [],
    materialIds.size ? tx.material.findMany({ where: { id: { in: [...materialIds] } } }) : [],
    categoriaIds.size ? tx.categoria.findMany({ where: { id: { in: [...categoriaIds] } } }) : [],
  ]);
  return {
    productos: new Map(productos.map((producto) => [producto.id, producto])),
    materiales: new Map(materiales.map((material) => [material.id, material])),
    categorias: new Map(categorias.map((categoria) => [categoria.id, categoria])),
  };
}

async function precioCatalogo({ referencias, entrada, anterior, tipoCambio }: ContextoItem) {
  if (entrada.tipo !== "CATALOGO") throw regla("ITEM_INVALIDO", "Seleccione un producto de catálogo.");
  if (anterior && anterior.productoId !== entrada.productoId) {
    throw regla("ITEM_IDENTIDAD", "Quite el producto y agregue otro para cambiar su producto.");
  }
  if (anterior && !entrada.actualizarPrecio) {
    return { productoId: anterior.productoId!, categoriaId: anterior.categoriaId,
      descripcion: anterior.descripcion, unidadCobro: anterior.unidadCobro, precioBase: anterior.precioUnitario.toFixed(2) };
  }
  const producto = referencias.productos.get(entrada.productoId);
  if (!producto?.activo) throw regla("PRODUCTO_ARCHIVADO", "Seleccione un producto activo.");
  return { productoId: producto.id, categoriaId: producto.categoriaId, descripcion: producto.nombre,
    unidadCobro: producto.unidadCobro,
    precioBase: convertirDesdeCordobas(producto.precioBase.toFixed(2), tipoCambio, 2) };
}

async function catalogo(contexto: ContextoItem): Promise<ItemCalculado> {
  const { entrada, anterior, secuencia, duplicando } = contexto;
  const producto = await precioCatalogo(contexto);
  const costeado = costearItemCatalogo({ ...producto, cantidad: entrada.cantidad, ancho: entrada.ancho, alto: entrada.alto,
    profundidad: entrada.profundidad });
  return { ...costeado, id: !duplicando && anterior ? anterior.id : randomUUID(), secuencia,
    productoId: producto.productoId, categoriaId: producto.categoriaId, descripcion: producto.descripcion, lineas: [] };
}

type LineaPreparada = EntradaLineaEditor & { cantidadPorArea?: boolean; areaUnidadInventario?: string | null };
type ContextoLinea = { referencias: ReferenciasCosteo; linea: EntradaLineaEditor; anterior?: ItemGuardado; tipoCambio: string;
  conMedidas: boolean; duplicando?: boolean };
async function prepararLinea({ referencias, linea, anterior, tipoCambio, conMedidas, duplicando }: ContextoLinea): Promise<LineaPreparada> {
  const guardada = anterior?.lineasCosto.find(({ id }) => id === linea.lineaId);
  if (linea.lineaId && !guardada) throw regla("LINEA_AJENA", "La línea no pertenece al producto.");
  if (linea.tipo !== "MATERIAL" || !linea.materialId) return linea;
  const existente = guardada?.materialId === linea.materialId;
  const material = referencias.materiales.get(linea.materialId);
  if (!material || (!material.activo && !existente)) throw regla("MATERIAL_ARCHIVADO", "Seleccione un material activo.");
  const modalidad = modalidadMaterial(material, conMedidas);
  const conservar = existente && (duplicando || !material.activo);
  if (!conservar && modalidad === "FALTA_AREA") throw new AppError({ codigo: "VALIDACION", status: 422,
    mensaje: MENSAJE_AREA_MATERIAL, campos: { materialId: MENSAJE_AREA_MATERIAL } });
  const costoUnitario = conservar ? guardada!.costoUnitario.toFixed(4)
    : convertirDesdeCordobas(precioParaCotizar(material), tipoCambio, 4);
  const unidad = conservar ? guardada!.unidad : modalidad === "AREA" ? "M2" : material.unidadCotizacion ?? linea.unidad;
  return { ...linea, unidad, lineaId: duplicando ? undefined : linea.lineaId, costoUnitario,
    cantidadPorArea: conservar ? guardada!.cantidadPorArea : modalidad === "AREA",
    areaUnidadInventario: (conservar ? guardada!.areaUnidadInventario : material.areaUnidadInventario)?.toFixed(6) ?? null };
}

async function exigirCategoria(contexto: ContextoItem): Promise<void> {
  if (contexto.entrada.tipo !== "PERSONALIZADO") return;
  const categoria = contexto.referencias.categorias.get(contexto.entrada.categoriaId);
  const existente = contexto.anterior?.categoriaId === contexto.entrada.categoriaId;
  if (!categoria || (!categoria.activo && !existente)) throw regla("CATEGORIA_ARCHIVADA", "Seleccione una categoría activa.");
}

async function lineasPersonalizadas(contexto: ContextoItem): Promise<LineaPreparada[]> {
  const { entrada, anterior, referencias, tipoCambio, duplicando } = contexto;
  if (entrada.tipo !== "PERSONALIZADO") return [];
  if (anterior && !entrada.actualizarPrecio) return anterior.lineasCosto.map((linea) => ({
    ...aEntradaLinea(aLineaDto(linea)), cantidadPorArea: linea.cantidadPorArea,
    areaUnidadInventario: linea.areaUnidadInventario?.toFixed(6) ?? null,
  }));
  const conMedidas = entrada.unidadCobro === "M2" || Boolean(entrada.ancho && entrada.alto);
  const lineas: LineaPreparada[] = [];
  for (const [indice, linea] of entrada.lineas.entries()) {
    try { lineas.push(await prepararLinea({ referencias, linea, anterior, tipoCambio, conMedidas, duplicando })); }
    catch (error) { prefijarError(error, `lineas.${indice}.`); }
  }
  return lineas;
}

function recalcularSuperficie(lineas: LineaPreparada[], entrada: EntradaItem): LineaPreparada[] {
  if (!lineas.some(({ cantidadPorArea }) => cantidadPorArea)) return lineas;
  const cantidad = superficieTotal(entrada);
  if (!cantidad) {
    const mensaje = "Ingrese las medidas de el trabajo para calcular el material en m².";
    throw new AppError({ codigo: "VALIDACION", status: 422, mensaje, campos: { ancho: mensaje, alto: mensaje } });
  }
  return lineas.map((linea) => linea.tipo === "MATERIAL" && linea.cantidadPorArea ? { ...linea, cantidad } : linea);
}

async function personalizado(contexto: ContextoItem): Promise<ItemCalculado> {
  const { entrada, anterior, secuencia, duplicando } = contexto;
  if (entrada.tipo !== "PERSONALIZADO") throw regla("ITEM_INVALIDO", "Seleccione un producto personalizado.");
  await exigirCategoria(contexto);
  const medidas = { unidadCobro: entrada.unidadCobro, precioBase: "0", cantidad: entrada.cantidad,
    ancho: entrada.ancho, alto: entrada.alto, profundidad: entrada.profundidad };
  const campos = validarItemCatalogo(medidas);
  if (Object.keys(campos).length) throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.", campos });
  let lineas = recalcularSuperficie(await lineasPersonalizadas(contexto), entrada);
  const margenPct = anterior && !entrada.actualizarPrecio ? anterior.margenPct!.toFixed(2) : entrada.margenPct;
  const gastos = anterior && !entrada.actualizarPrecio ? anterior.gastosPersonalizados : entrada.gastosPersonalizados;
  const producto = anterior && !entrada.actualizarPrecio ? anterior.productoPersonalizado : entrada.productoPersonalizado;
  if (gastos) {
    lineas = lineas.filter(l => !l.esGastoPersonalizado);
    const generados = gastosCalculados({ gastos: esquemaGastos.parse(gastos), lineas: lineas.map(aLineaMotor), cantidad: entrada.cantidad, margenPct });
    lineas.push(...generados.map(f => ({ tipo: "TERCERO" as const, descripcion: f.descripcion, unidad: "gasto", costo: f.costo, esGastoPersonalizado: true,
      lineaId: !duplicando ? anterior?.lineasCosto.find(l => l.esGastoPersonalizado && l.descripcion === f.descripcion)?.id : undefined })));
  } else lineas = lineas.filter(l => !l.esGastoPersonalizado);
  const costeado = costearItemPersonalizado({ cantidad: entrada.cantidad, margenPct, lineas: lineas.map(aLineaMotor) });
  return { ...costeado, id: !duplicando && anterior ? anterior.id : randomUUID(), secuencia,
    productoId: null, categoriaId: entrada.categoriaId, descripcion: entrada.descripcion,
    unidadCobro: entrada.unidadCobro, ancho: entrada.ancho ?? null, alto: entrada.alto ?? null,
    profundidad: entrada.profundidad ?? null,
    ...(gastos ? { gastosPersonalizados: esquemaGastos.parse(gastos) } : {}),
    ...(producto ? { productoPersonalizado: esquemaSeleccionProducto.parse(producto) } : {}),
    lineas: costeado.lineas.map((linea, indice) => ({ ...linea,
      id: !duplicando && lineas[indice].lineaId ? lineas[indice].lineaId : randomUUID(), secuencia: indice + 1,
      ...(lineas[indice].esGastoPersonalizado ? { esGastoPersonalizado: true } : {}),
      descripcion: lineas[indice].descripcion, unidad: lineas[indice].unidad,
      cantidadPorArea: lineas[indice].cantidadPorArea ?? false, areaUnidadInventario: lineas[indice].areaUnidadInventario ?? null,
      materialId: lineas[indice].tipo === "MATERIAL" ? lineas[indice].materialId ?? null : null })) };
}

export async function costearItems(tx: Tx, peticion: { items: EntradaItem[]; anteriores: ItemGuardado[]; tipoCambio: string; duplicando?: boolean }) {
  const anteriores = new Map(peticion.anteriores.map((item) => [item.id, item]));
  const referencias = await cargarReferencias(tx, peticion.items, anteriores);
  const costeados: ItemCalculado[] = [];
  const usados = new Set<string>();
  for (const [indice, entrada] of peticion.items.entries()) {
    const anterior = entrada.itemId ? anteriores.get(entrada.itemId) : undefined;
    if (entrada.itemId && (!anterior || usados.has(entrada.itemId))) throw regla("ITEM_AJENO", "El producto no pertenece a la cotización o está repetido.");
    if (entrada.itemId) usados.add(entrada.itemId);
    if (anterior && anterior.tipo !== entrada.tipo) throw regla("ITEM_IDENTIDAD", "Quite el producto y agregue otro para cambiar su tipo.");
    const contexto = { referencias, entrada, anterior, secuencia: indice + 1, tipoCambio: peticion.tipoCambio, duplicando: peticion.duplicando };
    try { costeados.push(await (entrada.tipo === "CATALOGO" ? catalogo(contexto) : personalizado(contexto))); }
    catch (error) { prefijarError(error, `items.${indice}.`); }
  }
  return costeados;
}
