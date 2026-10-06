// Bloqueos del consumo y la devolución. Orden fija: clave de idempotencia, orden (FOR SHARE) y materiales
// (FOR UPDATE, uno por uno en orden ascendente). Ninguna operación toma un material antes que la orden.
import type { Tx } from "@/lib/db";
import { noEncontrado } from "@/modules/ordenes/errores";
import type { LineaNormalizada } from "./consumo-calculo";
import type { MaterialBloqueado } from "./consumo-validacion";

/**
 * FOR SHARE convive con otros consumos de la misma orden y choca con el UPDATE de la cancelación.
 * El estado se lee con el bloqueo ya tomado: en READ COMMITTED la lectura con bloqueo devuelve la última
 * versión confirmada, así un consumo nunca se confirma sobre una orden ya cancelada.
 */
export async function bloquearOrden(tx: Tx, ordenId: string): Promise<string> {
  const filas = await tx.$queryRaw<{ estado: string }[]>`
    SELECT estado::text AS estado FROM orden_trabajo WHERE id = ${ordenId}::uuid FOR SHARE`;
  if (!filas.length) throw noEncontrado();
  return filas[0].estado;
}

// Un SELECT por material: con un solo SELECT ... ORDER BY ... FOR UPDATE PostgreSQL no garantiza el orden
// en que toma los bloqueos y dos solicitudes cruzadas podrían interbloquearse.
export async function bloquearMateriales(tx: Tx, lineas: LineaNormalizada[]): Promise<Map<string, MaterialBloqueado>> {
  const materiales = new Map<string, MaterialBloqueado>();
  for (const linea of lineas) {
    const filas = await tx.$queryRaw<MaterialBloqueado[]>`
      SELECT id::text AS id, codigo, nombre, unidad::text AS unidad, existencia::text AS existencia, activo
        FROM material WHERE id = ${linea.materialId}::uuid FOR UPDATE`;
    if (filas.length) materiales.set(linea.materialId, filas[0]);
  }
  return materiales;
}

/** Consumido neto por la orden y material. Exacto porque los materiales ya están bloqueados. */
export async function leerNetos(tx: Tx, ordenId: string, materialIds: string[]): Promise<Map<string, string>> {
  const filas = await tx.$queryRaw<{ materialId: string; neto: string }[]>`
    SELECT c.material_id::text AS "materialId", (-SUM(m.cantidad))::text AS neto
      FROM consumo_orden c JOIN movimiento_inventario m ON m.id = c.movimiento_id
     WHERE c.orden_id = ${ordenId}::uuid AND c.material_id = ANY(${materialIds}::uuid[])
     GROUP BY c.material_id`;
  return new Map(filas.map((fila) => [fila.materialId, fila.neto]));
}
