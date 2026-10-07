import { CERO, formatear, leerDecimal, multiplicar, restar, sumar, type Racional } from "@/core/decimal";
import type { Tx } from "@/lib/db";

type FilaCosto = { materialId: string; cantidad: string; costoUnitario: string };
export type CostosReales = { porMaterial: Record<string, string>; total: string };
export function calcularCostos(filas: FilaCosto[]): CostosReales {
  const porMaterial = new Map<string, Racional>();
  for (const fila of filas) {
    const cantidad = leerDecimal(fila.cantidad), costo = leerDecimal(fila.costoUnitario);
    if (!cantidad || !costo) throw new Error("El libro contiene un valor decimal inválido.");
    const importe = restar(CERO, multiplicar(cantidad, costo));
    porMaterial.set(fila.materialId, sumar(porMaterial.get(fila.materialId) ?? CERO, importe));
  }
  const total = [...porMaterial.values()].reduce(sumar, CERO);
  return { porMaterial: Object.fromEntries([...porMaterial].map(([id, valor]) => [id, formatear(valor, 7)])), total: formatear(total, 7) };
}
export async function leerCostos(tx: Tx, ordenId: string): Promise<CostosReales> {
  const filas = await tx.$queryRaw<FilaCosto[]>`
    SELECT c.material_id::text AS "materialId", m.cantidad::text AS cantidad, m.costo_unitario::text AS "costoUnitario"
      FROM consumo_orden c JOIN movimiento_inventario m ON m.id = c.movimiento_id
     WHERE c.orden_id = ${ordenId}::uuid AND m.tipo IN ('CONSUMO', 'DEVOLUCION')
     ORDER BY c.material_id, m.creado_en, m.id`;
  return calcularCostos(filas);
}
