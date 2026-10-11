import { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";

import type { ConsultaCategorias, ConsultaMateriales, ConsultaProductos, EntradaCrearProducto } from "./schema";

const COLUMNAS_PRODUCTO = {
  codigo: "codigo", nombre: "nombre", descripcion: "descripcion", categoriaId: "categoria_id",
  unidadCobro: "unidad_cobro", precioBase: "precio_base", costoUnitario: "costo_unitario", activo: "activo",
} as const;
const COLUMNAS_CATEGORIA = { nombre: "nombre", descripcion: "descripcion", activo: "activo" } as const;
type Condicion = { id: string; activo: boolean; version: string };
export type CambiosProducto = Partial<Record<keyof typeof COLUMNAS_PRODUCTO, string | boolean | null>>;
export type CambiosCategoria = Partial<Record<keyof typeof COLUMNAS_CATEGORIA, string | boolean | null>>;

function contiene(texto: string) {
  return { contains: texto.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
}
export async function consultarProductos(consulta: ConsultaProductos) {
  const where: Prisma.ProductoWhereInput = { activo: consulta.activo, categoriaId: consulta.categoriaId };
  if (consulta.q) where.OR = [{ nombre: contiene(consulta.q) }, { codigo: contiene(consulta.q) }, { descripcion: contiene(consulta.q) }];
  const [filas, total] = await Promise.all([
    prisma.producto.findMany({ where, include: { categoria: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }],
      skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }),
    prisma.producto.count({ where }),
  ]);
  return { filas, total };
}
export function buscarProducto(tx: Tx, id: string) {
  return tx.producto.findUnique({ where: { id }, include: {
    categoria: true, receta: { include: { material: true }, orderBy: { materialId: "asc" } },
  } });
}
export function insertarProducto(tx: Tx, entrada: EntradaCrearProducto) {
  return tx.producto.create({ data: entrada, include: { categoria: true } });
}
function asignacionProducto(campo: keyof typeof COLUMNAS_PRODUCTO, valor: unknown) {
  const columna = Prisma.raw(COLUMNAS_PRODUCTO[campo]);
  if (campo === "unidadCobro") return Prisma.sql`${columna} = ${valor}::unidad_cobro`;
  if (campo === "categoriaId") return Prisma.sql`${columna} = ${valor}::uuid`;
  if (campo === "precioBase" || campo === "costoUnitario") return Prisma.sql`${columna} = ${valor}::numeric`;
  return Prisma.sql`${columna} = ${valor}`;
}

// La ventana de un milisegundo conserva las versiones serializadas por Prisma.
async function actualizarFila(tx: Tx, condicion: Condicion, escritura: { tabla: Prisma.Sql; asignaciones: Prisma.Sql[] }) {
  const prefijo = escritura.asignaciones.length ? Prisma.sql`${Prisma.join(escritura.asignaciones)},` : Prisma.empty;
  const desde = new Date(condicion.version);
  const afectadas = await tx.$executeRaw`
    UPDATE ${escritura.tabla} SET ${prefijo}
      actualizado_en = GREATEST(date_trunc('milliseconds', clock_timestamp()),
        date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${condicion.id}::uuid AND activo = ${condicion.activo}
      AND actualizado_en >= ${desde}::timestamptz
      AND actualizado_en < ${desde}::timestamptz + interval '1 millisecond'`;
  return afectadas === 1;
}
export function actualizarProducto(tx: Tx, condicion: Condicion, cambios: CambiosProducto) {
  const asignaciones = (Object.entries(cambios) as [keyof typeof COLUMNAS_PRODUCTO, unknown][])
    .map(([campo, valor]) => asignacionProducto(campo, valor));
  return actualizarFila(tx, condicion, { tabla: Prisma.raw("producto"), asignaciones });
}
export function actualizarCategoria(tx: Tx, condicion: Condicion, cambios: CambiosCategoria) {
  const asignaciones = (Object.entries(cambios) as [keyof typeof COLUMNAS_CATEGORIA, unknown][])
    .map(([campo, valor]) => Prisma.sql`${Prisma.raw(COLUMNAS_CATEGORIA[campo])} = ${valor}`);
  return actualizarFila(tx, condicion, { tabla: Prisma.raw("categoria"), asignaciones });
}
export function consultarCategorias(consulta: ConsultaCategorias = { activo: undefined }) {
  return prisma.categoria.findMany({ where: {
    activo: consulta.activo, nombre: consulta.q ? contiene(consulta.q) : undefined,
  }, orderBy: [{ nombre: "asc" }, { id: "asc" }] });
}
export function consultarMateriales(consulta: ConsultaMateriales) {
  return prisma.material.findMany({ where: { activo: consulta.activo,
    ...(consulta.q && { OR: [{ nombre: contiene(consulta.q) }, { codigo: contiene(consulta.q) }] }),
  }, orderBy: [{ nombre: "asc" }, { id: "asc" }],
  select: { id: true, codigo: true, nombre: true, unidad: true, costoPromedio: true, activo: true } });
}
