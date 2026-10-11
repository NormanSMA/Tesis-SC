import type { Categoria, Material, Prisma } from "@/generated/prisma/client";

import type { CategoriaDto, FichaProducto, MaterialDto, ProductoDto } from "./tipos";

export type FilaProducto = Prisma.ProductoGetPayload<{ include: { categoria: true } }>;
export type FilaFicha = Prisma.ProductoGetPayload<{
  include: { categoria: true; receta: { include: { material: true } } };
}>;

export function aCategoriaDto(categoria: Categoria): CategoriaDto {
  return { ...categoria, actualizadoEn: categoria.actualizadoEn.toISOString() };
}
export function aMaterialDto(material: Pick<Material, "id" | "codigo" | "nombre" | "unidad" | "costoPromedio" | "activo">): MaterialDto {
  return {
    id: material.id, codigo: material.codigo, nombre: material.nombre, unidad: material.unidad,
    costoPromedio: material.costoPromedio.toFixed(4), activo: material.activo,
  };
}
export function aProductoDto(producto: FilaProducto, conCosto = false): ProductoDto {
  return {
    id: producto.id, codigo: producto.codigo, nombre: producto.nombre, descripcion: producto.descripcion,
    categoriaId: producto.categoriaId, categoria: aCategoriaDto(producto.categoria),
    unidadCobro: producto.unidadCobro, precioBase: producto.precioBase.toFixed(2), activo: producto.activo,
    ...(conCosto && { costoUnitario: producto.costoUnitario?.toFixed(4) ?? null }),
    creadoEn: producto.creadoEn.toISOString(), actualizadoEn: producto.actualizadoEn.toISOString(),
  };
}
export function aFichaProducto(producto: FilaFicha, conCosto = false): FichaProducto {
  return {
    ...aProductoDto(producto, conCosto),
    receta: producto.receta.map((fila) => ({
      materialId: fila.materialId, cantidad: fila.cantidad.toFixed(3), material: aMaterialDto(fila.material),
    })),
  };
}
