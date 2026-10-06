import { can, exigir, type Actor } from "@/core/autorizacion";
import { Prisma } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { noEncontrado } from "@/modules/ordenes/errores";
import { admiteOperacion, cantidad3, resumirTotales } from "./consumo-calculo";
import type { MovimientoOrdenDto, ResumenMaterialOrden, ResumenOrdenInventario } from "./contrato-orden";
import { aMovimientoOrdenDto } from "./movimientos-orden-dto";

type FilaResumen = {
  id: string; codigo: string; nombre: string; unidad: string; existencia: string;
  estimado: string | null; consumido: string; devuelto: string;
};

/** Estimado, consumido, devuelto, neto y existencia por material de la orden, en una sola consulta. */
export async function leerResumenMateriales(tx: Tx, ordenId: string, materialIds?: string[]): Promise<ResumenMaterialOrden[]> {
  const filtro = materialIds ? Prisma.sql`WHERE mat.id = ANY(${materialIds}::uuid[])` : Prisma.empty;
  const filas = await tx.$queryRaw<FilaResumen[]>`
    WITH estimado AS (
      SELECT material_id, cantidad FROM consumo_estimado WHERE orden_id = ${ordenId}::uuid
    ), libro AS (
      SELECT c.material_id,
             SUM(CASE WHEN m.tipo = 'CONSUMO' THEN -m.cantidad ELSE 0 END) AS consumido,
             SUM(CASE WHEN m.tipo = 'DEVOLUCION' THEN m.cantidad ELSE 0 END) AS devuelto
        FROM consumo_orden c JOIN movimiento_inventario m ON m.id = c.movimiento_id
       WHERE c.orden_id = ${ordenId}::uuid
       GROUP BY c.material_id
    )
    SELECT mat.id::text AS id, mat.codigo, mat.nombre, mat.unidad::text AS unidad, mat.existencia::text AS existencia,
           e.cantidad::text AS estimado, COALESCE(l.consumido, 0)::text AS consumido, COALESCE(l.devuelto, 0)::text AS devuelto
      FROM estimado e FULL JOIN libro l ON l.material_id = e.material_id
      JOIN material mat ON mat.id = COALESCE(e.material_id, l.material_id)
      ${filtro}
     ORDER BY mat.nombre, mat.id`;
  return filas.map((fila) => ({
    material: { id: fila.id, codigo: fila.codigo, nombre: fila.nombre, unidad: fila.unidad },
    ...resumirTotales(fila), existencia: cantidad3(fila.existencia),
  }));
}

async function leerMovimientos(tx: Tx, ordenId: string, verCostos: boolean): Promise<MovimientoOrdenDto[]> {
  const enlaces = await tx.consumoOrden.findMany({
    where: { ordenId },
    orderBy: [{ movimiento: { creadoEn: "desc" } }, { movimientoId: "desc" }],
    include: { movimiento: { include: {
      material: { select: { id: true, codigo: true, nombre: true, unidad: true } },
      usuario: { select: { nombre: true } },
    } } },
  });
  return enlaces.map((enlace) => aMovimientoOrdenDto(enlace.movimiento, verCostos));
}

/**
 * GET /ordenes/[id]/consumos. Lectura en REPEATABLE READ: resumen y movimientos salen de la misma
 * instantánea y un consumo concurrente no los descuadra.
 */
export async function obtenerResumenOrden(ordenId: string, actor: Actor): Promise<ResumenOrdenInventario> {
  exigir(actor, "orden:ver");
  exigir(actor, "inventario:ver");
  return prisma.$transaction(async (tx) => {
    const orden = await tx.ordenTrabajo.findUnique({ where: { id: ordenId }, select: { estado: true } });
    if (!orden) throw noEncontrado();
    return {
      ordenId, estadoOrden: orden.estado,
      admiteConsumo: admiteOperacion("consumo", orden.estado), admiteDevolucion: admiteOperacion("devolucion", orden.estado),
      materiales: await leerResumenMateriales(tx, ordenId),
      movimientos: await leerMovimientos(tx, ordenId, can(actor, "cotizacion:ver")),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
