import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Notificacion, TipoNotificacion } from "./tipos";

type Fila = { id: string; titulo: string; detalle: string; destino: string; fecha: Date };
const LIMITE = 15;
// Un día de calendario de Managua se vuelve relevante al comenzar el día siguiente.
const finDia = (columna: Prisma.Sql) => Prisma.sql`((${columna} + 1)::timestamp AT TIME ZONE 'America/Managua')`;

async function leer(tipo: TipoNotificacion, alerta: boolean, consulta: Prisma.Sql): Promise<Notificacion[]> {
  const filas = await prisma.$queryRaw<Fila[]>(consulta);
  return filas.map((fila) => ({ ...fila, id: `${tipo}:${fila.id}:${fila.fecha.toISOString()}`, tipo, alerta,
    fecha: fila.fecha.toISOString() }));
}

const ANTERIORES_CERRADAS = Prisma.sql`NOT EXISTS (SELECT 1 FROM etapa_orden p WHERE p.orden_id = e.orden_id
  AND p.secuencia < e.secuencia AND p.estado NOT IN ('COMPLETADA', 'OMITIDA'))`;

/** Cada etapa es un aviso propio: quien tiene dos áreas en la misma orden recibe uno por etapa. */
export function etapasDisponibles(actorId: string) {
  return leer("ETAPA_DISPONIBLE", false, Prisma.sql`SELECT e.id, 'Etapa disponible · ' || o.numero AS titulo,
      e.nombre || ' · ' || a.nombre AS detalle, '/ordenes/' || o.id AS destino,
      GREATEST(e.actualizado_en, COALESCE((SELECT max(p.actualizado_en) FROM etapa_orden p
        WHERE p.orden_id = e.orden_id AND p.secuencia < e.secuencia), e.actualizado_en)) AS fecha
    FROM etapa_orden e JOIN orden_trabajo o ON o.id = e.orden_id JOIN area a ON a.id = e.area_id
    WHERE e.responsable_id = ${actorId}::uuid AND e.estado = 'PENDIENTE' AND o.estado IN ('PENDIENTE', 'EN_PRODUCCION')
      AND ${ANTERIORES_CERRADAS} ORDER BY fecha DESC LIMIT ${LIMITE}`);
}

export function etapasAtrasadas(actorId: string, hoy: string) {
  return leer("ETAPA_ATRASADA", true, Prisma.sql`SELECT e.id, 'Etapa atrasada · ' || o.numero AS titulo,
      e.nombre || ' · ' || a.nombre AS detalle, '/ordenes/' || o.id AS destino, ${finDia(Prisma.sql`e.fecha_fin_plan`)} AS fecha
    FROM etapa_orden e JOIN orden_trabajo o ON o.id = e.orden_id JOIN area a ON a.id = e.area_id
    WHERE e.responsable_id = ${actorId}::uuid AND e.estado IN ('PENDIENTE', 'EN_CURSO')
      AND o.estado IN ('PENDIENTE', 'EN_PRODUCCION') AND e.fecha_fin_plan < ${hoy}::date
    ORDER BY e.fecha_fin_plan ASC LIMIT ${LIMITE}`);
}

export function ordenesNuevas() {
  return leer("ORDEN_NUEVA", false, Prisma.sql`SELECT o.id, 'Nueva orden · ' || o.numero AS titulo, c.nombre AS detalle,
      '/ordenes/' || o.id AS destino, o.creado_en AS fecha
    FROM orden_trabajo o JOIN cliente c ON c.id = o.cliente_id
    WHERE o.estado IN ('PENDIENTE', 'EN_PRODUCCION') AND o.creado_en > now() - interval '7 days'
    ORDER BY o.creado_en DESC LIMIT ${LIMITE}`);
}

export function ordenesAtrasadas(hoy: string) {
  return leer("ORDEN_ATRASADA", true, Prisma.sql`SELECT o.id, 'Orden atrasada · ' || o.numero AS titulo,
      c.nombre AS detalle, '/ordenes/' || o.id AS destino, ${finDia(Prisma.sql`o.fecha_entrega`)} AS fecha
    FROM orden_trabajo o JOIN cliente c ON c.id = o.cliente_id
    WHERE o.estado IN ('PENDIENTE', 'EN_PRODUCCION', 'LISTA') AND o.fecha_entrega < ${hoy}::date
    ORDER BY o.fecha_entrega ASC LIMIT ${LIMITE}`);
}

export function ordenesListas() {
  return leer("ORDEN_LISTA", false, Prisma.sql`SELECT o.id, 'Orden lista para entregar · ' || o.numero AS titulo,
      c.nombre AS detalle, '/ordenes/' || o.id AS destino, o.actualizado_en AS fecha
    FROM orden_trabajo o JOIN cliente c ON c.id = o.cliente_id WHERE o.estado = 'LISTA'
    ORDER BY o.actualizado_en DESC LIMIT ${LIMITE}`);
}

export function stockBajo() {
  return leer("STOCK_BAJO", true, Prisma.sql`SELECT m.id, 'Stock bajo · ' || m.nombre AS titulo,
      'Existencia ' || to_char(m.existencia, 'FM999999990.999') || ', mínimo ' || to_char(m.stock_minimo, 'FM999999990.999') AS detalle,
      '/inventario/' || m.id AS destino, m.actualizado_en AS fecha
    FROM material m WHERE m.activo AND m.stock_minimo > 0 AND m.existencia <= m.stock_minimo
    ORDER BY m.actualizado_en DESC LIMIT ${LIMITE}`);
}

/** autorId limita el aviso a las cotizaciones propias cuando el usuario no ve las de otros. */
export function cotizacionesAprobadas(autorId: string | null) {
  return leer("COTIZACION_APROBADA", false, Prisma.sql`SELECT q.id, 'Cotización aprobada · ' || q.numero AS titulo,
      c.nombre || ' · pendiente de convertir en orden' AS detalle, '/cotizaciones/' || q.id AS destino,
      COALESCE(q.fecha_respuesta, q.actualizado_en) AS fecha
    FROM cotizacion q JOIN cliente c ON c.id = q.cliente_id
    WHERE q.estado = 'APROBADA' AND NOT q.archivada AND NOT EXISTS (SELECT 1 FROM orden_trabajo o WHERE o.cotizacion_id = q.id)
      AND (${autorId}::uuid IS NULL OR q.creado_por_id = ${autorId}::uuid)
    ORDER BY fecha DESC LIMIT ${LIMITE}`);
}
