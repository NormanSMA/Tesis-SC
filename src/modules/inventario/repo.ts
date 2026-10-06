import { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { incluirMovimiento } from "./dto";
import { noEncontrado } from "./errores";
import { limitesFecha } from "./reglas";
import type { ConsultaMateriales, ConsultaMovimientos, EditarMaterial } from "./schema";

export async function bloquearMaterial(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM material WHERE id = ${id}::uuid FOR UPDATE`;
  const actual = await tx.material.findUnique({ where: { id } });
  if (!actual) throw noEncontrado();
  return actual;
}
function filtroAlerta(): Prisma.MaterialWhereInput {
  return { activo: true, stockMinimo: { gt: 0 }, existencia: { lte: prisma.material.fields.stockMinimo } };
}
export async function consultarMateriales(consulta: ConsultaMateriales) {
  const where: Prisma.MaterialWhereInput = { activo: consulta.activo === "todos" ? undefined : consulta.activo === "true" };
  if (consulta.q) {
    const texto = { contains: consulta.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
    where.OR = [{ nombre: texto }, { codigo: texto }, { descripcion: texto }];
  }
  if (consulta.bajoMinimo === "true") where.AND = [filtroAlerta()];
  const [filas, total, materiales, enAlerta, sinExistencia] = await Promise.all([
    prisma.material.findMany({ where, orderBy: [{ nombre: "asc" }, { id: "asc" }],
      skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }),
    prisma.material.count({ where }), prisma.material.count(), prisma.material.count({ where: filtroAlerta() }),
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
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }], skip: (consulta.pagina - 1) * consulta.porPagina, take: consulta.porPagina }),
    prisma.movimientoInventario.count({ where }),
  ]);
  return { filas, total };
}
export async function consultarOpcionesLibro(verOrdenes: boolean) {
  const [materiales, usuarios, ordenes] = await Promise.all([
    prisma.material.findMany({ select: { id: true, codigo: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
    prisma.usuario.findMany({ select: { id: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
    verOrdenes ? prisma.ordenTrabajo.findMany({ select: { id: true, numero: true }, orderBy: [{ creadoEn: "desc" }, { id: "desc" }] }) : [],
  ]);
  return { materiales, usuarios, ordenes };
}
