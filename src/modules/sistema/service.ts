import { exigir, type Actor } from "@/core/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { prisma } from "@/lib/db";
import { listarErrores, resumirMetricas, type ErrorMedido, type ResumenMetricas } from "@/lib/metricas";
import { version } from "../../../package.json";

import { evaluarEstado, type EstadoGeneral } from "./reglas";

const VENTANA_24H_MS = 24 * 60 * 60 * 1000;

export async function purgarSesionesCaducadas(actor: Actor, ahora = new Date()): Promise<{ borradas: number }> {
  exigir(actor, "configuracion:gestionar");
  const limite = new Date(ahora.getTime() - VENTANA_24H_MS);
  return prisma.$transaction(async (tx) => {
    const { count: borradas } = await tx.sesion.deleteMany({
      where: { OR: [{ expiraEn: { lt: limite } }, { revocadaEn: { lt: limite } }] },
    });
    await registrarEvento(tx, {
      entidad: "USUARIO", entidadId: actor.id, accion: "EDITAR", actorId: actor.id,
      detalle: { operacion: "PURGAR_SESIONES_CADUCADAS", borradas },
    });
    return { borradas };
  });
}

export type EstadoSistemaDto = {
  generadoEn: string;
  estado: EstadoGeneral;
  alertas: string[];
  rendimiento: Omit<ResumenMetricas, "desde"> & { desde: string };
  erroresRecientes: (Omit<ErrorMedido, "hora"> & { hora: string })[];
  baseDatos: { disponible: boolean; latenciaMs: number | null; tamanoBytes: number | null; conexiones: number | null };
  proceso: { version: string; activoSegundos: number; memoriaRssBytes: number; heapUsadoBytes: number; heapTotalBytes: number; node: string };
  accesos24h: { iniciosFallidos: number; usuariosBloqueados: number };
};

/** Devuelve null si la consulta falla: una métrica que no responde no debe tumbar toda la pantalla. */
async function intentar<T>(consulta: () => Promise<T>): Promise<T | null> {
  try {
    return await consulta();
  } catch {
    return null;
  }
}

async function medirBase() {
  const inicio = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  return Math.round((performance.now() - inicio) * 10) / 10;
}

export async function obtenerEstadoSistema(actor: Actor): Promise<EstadoSistemaDto> {
  exigir(actor, "configuracion:gestionar");
  const ahora = new Date();
  const desde24h = new Date(ahora.getTime() - VENTANA_24H_MS);
  const [latenciaMs, tamano, conexiones, fallidos, bloqueados] = await Promise.all([
    intentar(medirBase),
    intentar(() => prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`),
    intentar(() => prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = current_database()`),
    intentar(() => prisma.bitacora.count({ where: { accion: "INICIO_SESION_FALLIDO", creadoEn: { gte: desde24h } } })),
    intentar(() => prisma.bitacora.findMany({
      where: { accion: "BLOQUEAR_CUENTA", creadoEn: { gte: desde24h } }, distinct: ["usuarioId"], select: { usuarioId: true },
    })),
  ]);
  const metricas = resumirMetricas(ahora.getTime());
  const memoria = process.memoryUsage();
  const { estado, alertas } = evaluarEstado(latenciaMs !== null, metricas);
  return {
    generadoEn: ahora.toISOString(),
    estado,
    alertas,
    rendimiento: { ...metricas, desde: new Date(metricas.desde).toISOString() },
    erroresRecientes: listarErrores().map((e) => ({ ...e, hora: new Date(e.hora).toISOString() })),
    baseDatos: {
      disponible: latenciaMs !== null,
      latenciaMs,
      tamanoBytes: tamano?.[0] ? Number(tamano[0].bytes) : null,
      conexiones: conexiones?.[0]?.total ?? null,
    },
    proceso: {
      version,
      activoSegundos: Math.round(process.uptime()),
      memoriaRssBytes: memoria.rss,
      heapUsadoBytes: memoria.heapUsed,
      heapTotalBytes: memoria.heapTotal,
      node: process.version,
    },
    accesos24h: { iniciosFallidos: fallidos ?? 0, usuariosBloqueados: bloqueados?.length ?? 0 },
  };
}
