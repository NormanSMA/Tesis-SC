import { can, type Actor } from "@/core/autorizacion";
import { prisma } from "@/lib/db";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { soloEtapasPropias } from "@/modules/produccion/acceso";
import { cotizacionesAprobadas, etapasAtrasadas, etapasDisponibles, ordenesAtrasadas, ordenesListas, ordenesNuevas, stockBajo } from "./fuentes";
import type { CentroNotificaciones, Notificacion } from "./tipos";

const MAXIMO = 30;

// Cada fuente exige su permiso: la campana solo muestra lo que el usuario puede abrir.
function fuentes(actor: Actor, hoy: string): Promise<Notificacion[]>[] {
  const lista: Promise<Notificacion[]>[] = [];
  if (can(actor, "produccion:ejecutar")) lista.push(etapasDisponibles(actor.id), etapasAtrasadas(actor.id, hoy));
  if (can(actor, "orden:ver") && !soloEtapasPropias(actor)) lista.push(ordenesNuevas(), ordenesAtrasadas(hoy));
  if (can(actor, "orden:entregar") && !soloEtapasPropias(actor)) lista.push(ordenesListas());
  if (can(actor, "inventario:ver")) lista.push(stockBajo());
  if (can(actor, "orden:crear") && can(actor, "cotizacion:ver")) {
    lista.push(cotizacionesAprobadas(can(actor, "cotizacion:ver_todas") ? null : actor.id));
  }
  return lista;
}

export async function obtenerNotificaciones(actor: Actor, instante = new Date()): Promise<CentroNotificaciones> {
  const [grupos, lectura] = await Promise.all([Promise.all(fuentes(actor, hoyManagua(instante))),
    prisma.notificacionLectura.findUnique({ where: { usuarioId: actor.id } })]);
  const datos = grupos.flat().sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id)).slice(0, MAXIMO);
  const leidasHasta = lectura?.leidasHasta.toISOString() ?? null;
  return { datos, noLeidas: datos.filter((aviso) => !leidasHasta || aviso.fecha > leidasHasta).length, leidasHasta };
}

export async function marcarLeidas(actor: Actor, instante = new Date()) {
  await prisma.notificacionLectura.upsert({ where: { usuarioId: actor.id },
    create: { usuarioId: actor.id, leidasHasta: instante }, update: { leidasHasta: instante } });
  return { leidasHasta: instante.toISOString() };
}
