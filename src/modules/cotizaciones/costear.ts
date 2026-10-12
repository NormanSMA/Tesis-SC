import { randomUUID } from "node:crypto";
import { costearItemCatalogo, costearItemPersonalizado, validarItemCatalogo } from "@/core/costeo";
import type { Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { aLineaDto } from "./dto";
import { prefijarError, regla } from "./errores";
import { aEntradaLinea, aLineaMotor } from "./mapeo";
import type { ItemGuardado } from "./repo";
import type { EntradaItem, EntradaLineaEditor } from "./schema";

type LineaCalculada = {
  id: string; secuencia: number; tipo: "MATERIAL" | "MANO_OBRA" | "TERCERO";
  descripcion: string; materialId: string | null; unidad: string;
  cantidad: string; costoUnitario: string; mermaPct: string; importe: string;
};
export type ItemCalculado = {
  id: string; secuencia: number; tipo: "CATALOGO" | "PERSONALIZADO"; productoId: string | null;
  categoriaId: string; descripcion: string; unidadCobro: "UNIDAD" | "M2";
  cantidad: string; ancho: string | null; alto: string | null; precioUnitario: string;
  costoTotal: string | null; margenPct: string | null; importe: string; lineas: LineaCalculada[];
};
type ReferenciasCosteo = Awaited<ReturnType<typeof cargarReferencias>>;
type ContextoItem = { referencias: ReferenciasCosteo; entrada: EntradaItem; anterior?: ItemGuardado; secuencia: number; duplicando?: boolean };

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

async function precioCatalogo({ referencias, entrada, anterior }: ContextoItem) {
  if (entrada.tipo !== "CATALOGO") throw regla("ITEM_INVALIDO", "Seleccione un producto de catálogo.");
  if (anterior && anterior.productoId !== entrada.productoId) {
    throw regla("ITEM_IDENTIDAD", "Quite el ítem y agregue otro para cambiar su producto.");
  }
  if (anterior && !entrada.actualizarPrecio) {
    return { productoId: anterior.productoId!, categoriaId: anterior.categoriaId,
      descripcion: anterior.descripcion, unidadCobro: anterior.unidadCobro, precioBase: anterior.precioUnitario.toFixed(2) };
  }
  const producto = referencias.productos.get(entrada.productoId);
  if (!producto?.activo) throw regla("PRODUCTO_ARCHIVADO", "Seleccione un producto activo.");
  return { productoId: producto.id, categoriaId: producto.categoriaId, descripcion: producto.nombre,
    unidadCobro: producto.unidadCobro, precioBase: producto.precioBase.toFixed(2) };
}

async function catalogo(contexto: ContextoItem): Promise<ItemCalculado> {
  const { entrada, anterior, secuencia, duplicando } = contexto;
  const producto = await precioCatalogo(contexto);
  const costeado = costearItemCatalogo({ ...producto, cantidad: entrada.cantidad, ancho: entrada.ancho, alto: entrada.alto });
  return { ...costeado, id: !duplicando && anterior ? anterior.id : randomUUID(), secuencia,
    productoId: producto.productoId, categoriaId: producto.categoriaId, descripcion: producto.descripcion, lineas: [] };
}

type ContextoLinea = { referencias: ReferenciasCosteo; linea: EntradaLineaEditor; anterior?: ItemGuardado; duplicando?: boolean };
async function prepararLinea({ referencias, linea, anterior, duplicando }: ContextoLinea): Promise<EntradaLineaEditor> {
  const guardada = anterior?.lineasCosto.find(({ id }) => id === linea.lineaId);
  if (linea.lineaId && !guardada) throw regla("LINEA_AJENA", "La línea no pertenece al ítem.");
  if (linea.tipo !== "MATERIAL" || !linea.materialId) return linea;
  const existente = guardada?.materialId === linea.materialId;
  const material = referencias.materiales.get(linea.materialId);
  if (!material || (!material.activo && !existente)) throw regla("MATERIAL_ARCHIVADO", "Seleccione un material activo.");
  // Con material registrado el costo lo fija el servidor: el guardado si la línea ya existe, o el promedio vigente.
  // El costo libre solo existe en líneas sin material (compras especiales).
  const costoUnitario = existente ? guardada!.costoUnitario.toFixed(4) : material.costoPromedio.toFixed(4);
  return { ...linea, lineaId: duplicando ? undefined : linea.lineaId, costoUnitario };
}

async function exigirCategoria(contexto: ContextoItem): Promise<void> {
  if (contexto.entrada.tipo !== "PERSONALIZADO") return;
  const categoria = contexto.referencias.categorias.get(contexto.entrada.categoriaId);
  const existente = contexto.anterior?.categoriaId === contexto.entrada.categoriaId;
  if (!categoria || (!categoria.activo && !existente)) throw regla("CATEGORIA_ARCHIVADA", "Seleccione una categoría activa.");
}

async function lineasPersonalizadas(contexto: ContextoItem): Promise<EntradaLineaEditor[]> {
  const { entrada, anterior, referencias, duplicando } = contexto;
  if (entrada.tipo !== "PERSONALIZADO") return [];
  if (anterior && !entrada.actualizarPrecio) return anterior.lineasCosto.map((linea) => aEntradaLinea(aLineaDto(linea)));
  const lineas: EntradaLineaEditor[] = [];
  for (const [indice, linea] of entrada.lineas.entries()) {
    try { lineas.push(await prepararLinea({ referencias, linea, anterior, duplicando })); }
    catch (error) { prefijarError(error, `lineas.${indice}.`); }
  }
  return lineas;
}

async function personalizado(contexto: ContextoItem): Promise<ItemCalculado> {
  const { entrada, anterior, secuencia, duplicando } = contexto;
  if (entrada.tipo !== "PERSONALIZADO") throw regla("ITEM_INVALIDO", "Seleccione un ítem personalizado.");
  await exigirCategoria(contexto);
  const medidas = { unidadCobro: entrada.unidadCobro, precioBase: "0", cantidad: entrada.cantidad,
    ancho: entrada.ancho, alto: entrada.alto };
  const campos = validarItemCatalogo(medidas);
  if (Object.keys(campos).length) throw new AppError({ codigo: "VALIDACION", status: 422, mensaje: "Hay campos con errores.", campos });
  const lineas = await lineasPersonalizadas(contexto);
  const margenPct = anterior && !entrada.actualizarPrecio ? anterior.margenPct!.toFixed(2) : entrada.margenPct;
  const costeado = costearItemPersonalizado({ cantidad: entrada.cantidad, margenPct, lineas: lineas.map(aLineaMotor) });
  return { ...costeado, id: !duplicando && anterior ? anterior.id : randomUUID(), secuencia,
    productoId: null, categoriaId: entrada.categoriaId, descripcion: entrada.descripcion,
    unidadCobro: entrada.unidadCobro, ancho: entrada.ancho ?? null, alto: entrada.alto ?? null,
    lineas: costeado.lineas.map((linea, indice) => ({ ...linea,
      id: !duplicando && lineas[indice].lineaId ? lineas[indice].lineaId : randomUUID(), secuencia: indice + 1,
      descripcion: lineas[indice].descripcion, unidad: lineas[indice].unidad,
      materialId: lineas[indice].tipo === "MATERIAL" ? lineas[indice].materialId ?? null : null })) };
}

export async function costearItems(tx: Tx, peticion: { items: EntradaItem[]; anteriores: ItemGuardado[]; duplicando?: boolean }) {
  const anteriores = new Map(peticion.anteriores.map((item) => [item.id, item]));
  const referencias = await cargarReferencias(tx, peticion.items, anteriores);
  const costeados: ItemCalculado[] = [];
  const usados = new Set<string>();
  for (const [indice, entrada] of peticion.items.entries()) {
    const anterior = entrada.itemId ? anteriores.get(entrada.itemId) : undefined;
    if (entrada.itemId && (!anterior || usados.has(entrada.itemId))) throw regla("ITEM_AJENO", "El ítem no pertenece a la cotización o está repetido.");
    if (entrada.itemId) usados.add(entrada.itemId);
    if (anterior && anterior.tipo !== entrada.tipo) throw regla("ITEM_IDENTIDAD", "Quite el ítem y agregue otro para cambiar su tipo.");
    const contexto = { referencias, entrada, anterior, secuencia: indice + 1, duplicando: peticion.duplicando };
    try { costeados.push(await (entrada.tipo === "CATALOGO" ? catalogo(contexto) : personalizado(contexto))); }
    catch (error) { prefijarError(error, `items.${indice}.`); }
  }
  return costeados;
}
