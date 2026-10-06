import { randomUUID } from "node:crypto";

import {
  aDecimal,
  importeCatalogo,
  importeLinea,
  importePersonalizado,
  precioUnitarioPersonalizado,
  sumar,
} from "./calculos";
import type { Escenario } from "./datos/esquemas";
import type { Catalogos, UnidadCobro } from "./tipos";

type ItemDatos = Escenario["items"][number];
type LineaDatos = NonNullable<ItemDatos["lineas"]>[number];

export type TipoLinea = "MATERIAL" | "MANO_OBRA" | "TERCERO";

export type LineaCalculada = {
  id: string;
  secuencia: number;
  tipo: TipoLinea;
  descripcion: string;
  materialId: string | null;
  unidad: string;
  cantidad: string;
  costoUnitario: string;
  mermaPct: string;
  importe: string;
};

export type ItemCalculado = {
  id: string;
  secuencia: number;
  tipo: "CATALOGO" | "PERSONALIZADO";
  productoId: string | null;
  productoCodigo: string | null;
  categoriaId: string;
  descripcion: string;
  unidadCobro: UnidadCobro;
  cantidad: string;
  ancho: string | null;
  alto: string | null;
  precioUnitario: string;
  costoTotal: string | null;
  margenPct: string | null;
  importe: string;
  lineas: LineaCalculada[];
};

function lineaMaterial(linea: Extract<LineaDatos, { tipo: "MATERIAL" }>, catalogos: Catalogos) {
  const material = catalogos.materiales.get(linea.material);
  if (!material) throw new Error(`Línea de costo con material inexistente: ${linea.material}`);
  return {
    tipo: "MATERIAL" as const,
    descripcion: linea.descripcion ?? material.nombre,
    materialId: material.id,
    unidad: material.unidad.toLowerCase(),
    cantidad: aDecimal(linea.cantidad, 3),
    costoUnitario: aDecimal(material.costoUnitario, 4),
    mermaPct: aDecimal(linea.mermaPct, 2),
  };
}

function lineaSinMaterial(linea: Exclude<LineaDatos, { tipo: "MATERIAL" }>) {
  const base = { materialId: null, mermaPct: "0.00" };
  if (linea.tipo === "MANO_OBRA") {
    return {
      ...base,
      tipo: linea.tipo,
      descripcion: linea.descripcion,
      unidad: "h",
      cantidad: aDecimal(linea.horas, 3),
      costoUnitario: aDecimal(linea.tarifa, 4),
    };
  }
  return {
    ...base,
    tipo: linea.tipo,
    descripcion: linea.descripcion,
    unidad: "servicio",
    cantidad: "1.000",
    costoUnitario: aDecimal(linea.costo, 4),
  };
}

function calcularLinea(linea: LineaDatos, secuencia: number, catalogos: Catalogos): LineaCalculada {
  const base = linea.tipo === "MATERIAL" ? lineaMaterial(linea, catalogos) : lineaSinMaterial(linea);
  const importe = importeLinea({ cantidad: base.cantidad, costoUnitario: base.costoUnitario, mermaPct: base.mermaPct });
  return { id: randomUUID(), secuencia, ...base, importe };
}

function itemCatalogo(item: ItemDatos, secuencia: number, catalogos: Catalogos): ItemCalculado {
  const producto = catalogos.productos.get(item.producto ?? "");
  if (!producto) throw new Error(`Ítem de catálogo con producto inexistente: ${item.producto}`);
  const porM2 = producto.unidadCobro === "M2";
  if (porM2 && (!item.ancho || !item.alto)) {
    throw new Error(`El producto ${producto.codigo} se cobra por m2 y el escenario no define ancho y alto`);
  }
  const ancho = porM2 && item.ancho ? aDecimal(item.ancho, 3) : null;
  const alto = porM2 && item.alto ? aDecimal(item.alto, 3) : null;
  const importe = importeCatalogo({
    unidadCobro: producto.unidadCobro,
    precioUnitario: producto.precioBase,
    cantidad: item.cantidad,
    ancho,
    alto,
  });
  return {
    id: randomUUID(),
    secuencia,
    tipo: "CATALOGO",
    productoId: producto.id,
    productoCodigo: producto.codigo,
    categoriaId: producto.categoriaId,
    descripcion: producto.nombre,
    unidadCobro: producto.unidadCobro,
    cantidad: aDecimal(item.cantidad, 3),
    ancho,
    alto,
    precioUnitario: aDecimal(producto.precioBase, 2),
    costoTotal: null,
    margenPct: null,
    importe,
    lineas: [],
  };
}

function itemPersonalizado(item: ItemDatos, secuencia: number, catalogos: Catalogos): ItemCalculado {
  const categoriaId = catalogos.categorias.get(item.categoria ?? "");
  if (!categoriaId) throw new Error(`Ítem personalizado con categoría inexistente: ${item.categoria}`);
  if (item.margenPct === undefined || !item.lineas?.length) {
    throw new Error(`El ítem personalizado "${item.descripcion}" requiere margen y líneas de costo`);
  }
  const lineas = item.lineas.map((linea, indice) => calcularLinea(linea, indice + 1, catalogos));
  const costoTotal = sumar(lineas.map((l) => l.importe), 2);
  const importe = importePersonalizado({ costoTotal, margenPct: item.margenPct });
  return {
    id: randomUUID(),
    secuencia,
    tipo: "PERSONALIZADO",
    productoId: null,
    productoCodigo: null,
    categoriaId,
    descripcion: item.descripcion ?? item.categoria ?? "Trabajo personalizado",
    unidadCobro: "UNIDAD",
    cantidad: aDecimal(item.cantidad, 3),
    ancho: null,
    alto: null,
    precioUnitario: precioUnitarioPersonalizado({ importe, cantidad: item.cantidad }),
    costoTotal,
    margenPct: aDecimal(item.margenPct, 2),
    importe,
    lineas,
  };
}

export function calcularItems(escenario: Escenario, catalogos: Catalogos): ItemCalculado[] {
  return escenario.items.map((item, indice) =>
    item.tipo === "CATALOGO"
      ? itemCatalogo(item, indice + 1, catalogos)
      : itemPersonalizado(item, indice + 1, catalogos),
  );
}
