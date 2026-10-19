import { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { incluirMovimiento } from "./dto";
import { noEncontrado } from "./errores";
import type { DireccionOrden, Orden } from "@/lib/listas/orden";
import { limitesFecha } from "./reglas";
import type { ConsultaMateriales, ConsultaMovimientos, EditarMaterial } from "./schema";
import { ORDEN_MATERIAL_DEFECTO, ORDEN_MOVIMIENTO_DEFECTO } from "./tipos";

export async function bloquearMaterial(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM material WHERE id = ${id}::uuid FOR UPDATE`;
  const actual = await tx.material.findUnique({ where: { id } });
  if (!actual) throw noEncontrado();
  return actual;
}
export function filtroAlerta(): Prisma.MaterialWhereInput {
  return { activo: true, stockMinimo: { gt: 0 }, existencia: { lte: prisma.material.fields.stockMinimo } };
}
/** Campo del orden elegido (lista blanca ya validada) más desempate por id en la misma dirección. */
function ordenLista<C extends string>(orden: Orden<C> | undefined, defecto: Orden<C>) {
  const { campo, direccion } = orden ?? defecto;
  return [{ [campo]: direccion }, { id: direccion }] as [Partial<Record<C, DireccionOrden>>, { id: DireccionOrden }];
}
export async function consultarMateriales(consulta: ConsultaMateriales) {
  const where: Prisma.MaterialWhereInput = { activo: consulta.activo === "todos" ? undefined : consulta.activo === "true" };
  if (consulta.q) {
    const texto = { contains: consulta.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
    where.OR = [{ nombre: texto }, { codigo: texto }, { descripcion: texto }];
  }
  if (consulta.bajoMinimo === "true") where.AND = [filtroAlerta()];
  const [filas, total, materiales, enAlerta, sinExistencia] = await Promise.all([
    prisma.material.findMany({ where, orderBy: ordenLista(consulta.ordenar, ORDEN_MATERIAL_DEFECTO),
      skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }),
    prisma.material.count({ where }), prisma.material.count({ where: { activo: true } }), prisma.material.count({ where: filtroAlerta() }),
    prisma.material.count({ where: { activo: true, existencia: 0 } }),
  ]);
  return { filas, total, resumen: { materiales, enAlerta, sinExistencia } };
}
export async function consultarConciliacion(id: string) {
  const [fila] = await prisma.$queryRaw<{ existencia: string; sumaLibro: string; conciliado: boolean }[]>`
    SELECT m.existencia::text AS existencia, COALESCE(SUM(l.cantidad), 0)::numeric(14,3)::text AS "sumaLibro",
      m.existencia = COALESCE(SUM(l.cantidad), 0) AS conciliado
    FROM material m LEFT JOIN movimiento_inventario l ON l.material_id = m.id
    WHERE m.id = ${id}::uuid GROUP BY m.id`;
  if (!fila) throw noEncontrado();
  return fila;
}
const COLUMNAS = { nombre: "nombre", descripcion: "descripcion", stockMinimo: "stock_minimo",
  costoPromedio: "costo_promedio", activo: "activo" } as const;
export type CambiosMaterial = Omit<EditarMaterial, "version"> & { activo?: boolean };
export async function actualizarCondicionado(tx: Tx, condicion: { id: string; version: string }, cambios: CambiosMaterial) {
  const asignaciones = Object.entries(cambios).map(([campo, valor]) => {
    const columna = Prisma.raw(COLUMNAS[campo as keyof typeof COLUMNAS]);
    return campo === "stockMinimo" || campo === "costoPromedio"
      ? Prisma.sql`${columna} = ${valor}::numeric` : Prisma.sql`${columna} = ${valor}`;
  });
  const desde = new Date(condicion.version);
  const afectadas = await tx.$executeRaw`UPDATE material SET ${Prisma.join(asignaciones)}, actualizado_en = GREATEST(
    date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${condicion.id}::uuid AND actualizado_en >= ${desde}::timestamptz
      AND actualizado_en < ${desde}::timestamptz + interval '1 millisecond'`;
  return afectadas === 1;
}
export async function consultarMovimientos(consulta: ConsultaMovimientos) {
  const where: Prisma.MovimientoInventarioWhereInput = { materialId: consulta.material, tipo: consulta.tipo,
    usuarioId: consulta.usuario, creadoEn: limitesFecha(consulta),
    ...(consulta.orden && { consumo: { ordenId: consulta.orden } }) };
  const [filas, total] = await Promise.all([
    prisma.movimientoInventario.findMany({ where, include: incluirMovimiento,
      orderBy: ordenLista(consulta.ordenar, ORDEN_MOVIMIENTO_DEFECTO), skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }),
    prisma.movimientoInventario.count({ where }),
  ]);
  return { filas, total };
}
/** Tope de opciones por selector del libro. La opción seleccionada se agrega siempre. */
export const TOPE_OPCIONES_LIBRO = 200;
export type SeleccionLibro = { material?: string; usuario?: string; orden?: string };
function conSeleccion<T extends { id: string }>(base: T[], actual: T[]) {
  const ids = new Set(base.map((fila) => fila.id));
  return [...base, ...actual.filter((fila) => !ids.has(fila.id))];
}
export async function consultarOpcionesLibro(verOrdenes: boolean, seleccion: SeleccionLibro = {}) {
  const [materiales, usuarios, ordenes, materialActual, usuarioActual, ordenActual] = await Promise.all([
    prisma.material.findMany({ select: { id: true, codigo: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }],
      take: TOPE_OPCIONES_LIBRO }),
    prisma.usuario.findMany({ select: { id: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }],
      take: TOPE_OPCIONES_LIBRO }),
    verOrdenes ? prisma.ordenTrabajo.findMany({ select: { id: true, numero: true }, orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      take: TOPE_OPCIONES_LIBRO }) : [],
    seleccion.material ? prisma.material.findMany({ where: { id: seleccion.material }, select: { id: true, codigo: true, nombre: true } }) : [],
    seleccion.usuario ? prisma.usuario.findMany({ where: { id: seleccion.usuario }, select: { id: true, nombre: true } }) : [],
    verOrdenes && seleccion.orden ? prisma.ordenTrabajo.findMany({ where: { id: seleccion.orden }, select: { id: true, numero: true } }) : [],
  ]);
  return { materiales: conSeleccion(materiales, materialActual), usuarios: conSeleccion(usuarios, usuarioActual),
    ordenes: conSeleccion(ordenes, ordenActual) };
}
