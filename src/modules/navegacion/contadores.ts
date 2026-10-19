import { can, type Actor } from "@/core/autorizacion";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { hoyManagua } from "@/modules/cotizaciones/fechas";

export type ContadorMenu = { total: number; tono: "neutro" | "peligro" };
export type ContadoresMenu = Record<string, ContadorMenu>;
type Conteo = { total: number; atrasadas: number };
type Fuente = { ruta: string; consulta: Prisma.Sql; tono: ContadorMenu["tono"] };

function cotizaciones(instante: Date, hoy: string): Prisma.Sql {
  return Prisma.sql`SELECT (
    count(*) FILTER (WHERE c.estado = 'ENVIADA' AND c.fecha_respuesta IS NULL
      AND (c.fecha_emision::timestamp AT TIME ZONE 'America/Managua') < ${instante}::timestamptz - interval '3 days')
    + count(*) FILTER (WHERE c.estado = 'ENVIADA' AND c.fecha_respuesta IS NULL
      AND c.fecha_vencimiento BETWEEN ${hoy}::date AND ${hoy}::date + 3)
    + count(*) FILTER (WHERE c.estado = 'AJUSTE_SOLICITADO' AND NOT EXISTS (
      SELECT 1 FROM cotizacion corregida WHERE corregida.cotizacion_origen_id = c.id
        AND corregida.version > c.version)))::int AS total, 0::int AS atrasadas
    FROM cotizacion c WHERE NOT c.archivada`;
}

function ordenes(hoy: string): Prisma.Sql {
  return Prisma.sql`SELECT (
    count(*) FILTER (WHERE fecha_entrega < ${hoy}::date)
    + count(*) FILTER (WHERE responsable_id IS NULL))::int AS total,
    (count(*) FILTER (WHERE fecha_entrega < ${hoy}::date))::int AS atrasadas
    FROM orden_trabajo WHERE estado NOT IN ('CERRADA','CANCELADA')`;
}

function etapas(actorId: string, hoy: string): Prisma.Sql {
  return Prisma.sql`SELECT count(*)::int AS total, 0::int AS atrasadas
    FROM etapa_orden e JOIN orden_trabajo o ON o.id = e.orden_id
    WHERE e.responsable_id = ${actorId}::uuid AND o.estado NOT IN ('CERRADA','CANCELADA')
      AND e.estado IN ('PENDIENTE','EN_CURSO') AND e.fecha_fin_plan < ${hoy}::date`;
}

export function resumirContadores(filas: { ruta: string; contador: ContadorMenu }[]): ContadoresMenu {
  return Object.fromEntries(filas.filter(({ contador }) => contador.total > 0)
    .map(({ ruta, contador }) => [ruta, contador]));
}

export async function obtenerContadores(actor: Actor, instante = new Date()): Promise<ContadoresMenu> {
  const hoy = hoyManagua(instante);
  const fuentes: Fuente[] = [];
  if (can(actor, "cotizacion:ver")) {
    fuentes.push({ ruta: "/cotizaciones", consulta: cotizaciones(instante, hoy), tono: "neutro" });
  }
  if (can(actor, "orden:ver")) {
    fuentes.push({ ruta: "/ordenes", consulta: ordenes(hoy), tono: "neutro" });
  }
  if (can(actor, "inventario:ver")) {
    fuentes.push({ ruta: "/inventario", tono: "peligro", consulta: Prisma.sql`
      SELECT count(*)::int AS total, 0::int AS atrasadas FROM material
      WHERE activo AND stock_minimo > 0 AND existencia <= stock_minimo` });
  }
  if (can(actor, "produccion:ver")) {
    fuentes.push({ ruta: "/produccion", consulta: etapas(actor.id, hoy), tono: "peligro" });
  }
  const filas = await Promise.all(fuentes.map(async ({ ruta, consulta, tono }) => {
    const [conteo] = await prisma.$queryRaw<Conteo[]>(consulta);
    return { ruta, contador: { total: conteo.total, tono: conteo.atrasadas > 0 ? "peligro" as const : tono } };
  }));
  return resumirContadores(filas);
}
