import type { UnidadCobro, UnidadMaterial } from "@/generated/prisma/enums";

export type CategoriaDto = {
  id: string; nombre: string; descripcion: string | null; activo: boolean; actualizadoEn: string;
};
export type MaterialDto = {
  id: string; codigo: string; nombre: string; unidad: UnidadMaterial; costoPromedio?: string; activo: boolean;
};
export type MaterialReceta = { materialId: string; cantidad: string; material: MaterialDto };
export type ProductoDto = {
  id: string; codigo: string; nombre: string; descripcion: string | null;
  categoriaId: string; categoria: CategoriaDto; unidadCobro: UnidadCobro; precioBase: string;
  costoUnitario?: string | null;
  activo: boolean; creadoEn: string; actualizadoEn: string;
};
export type FichaProducto = ProductoDto & { receta: MaterialReceta[] };
export type ListaProductos = { datos: ProductoDto[]; total: number; pagina: number; porPagina: number };
