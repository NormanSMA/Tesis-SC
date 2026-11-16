import { can, exigir, type Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { idsEtapasDisponibles, soloEtapasPropias } from "./acceso";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { consultarResponsables } from "@/modules/ordenes/repo";
import { aAreaDto, aEtapaDto } from "./dto";
import { consultarAreasProduccion, incluirEtapa } from "./repo";
import type { ConsultaTablero } from "./schema";
import type { EtapaTablero, GrupoEtapas, OpcionesProduccion, TableroProduccion } from "./tipos";

// Tope de etapas por petición del tablero. `total` informa el conteo completo.
const LIMITE_TABLERO = 500;

function filtroTablero(consulta: ConsultaTablero, verCotizacion: boolean | string): Prisma.EtapaOrdenWhereInput {
  const texto = consulta.q ? { contains: consulta.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } : undefined;
  return { estado: consulta.estado ?? { in: ["PENDIENTE", "EN_CURSO"] }, areaId: consulta.area, responsableId: consulta.responsable,
    orden: { estado: { notIn: ["ENTREGADA", "CERRADA", "CANCELADA"] },
      ...(texto && { OR: [{ numero: texto }, { cliente: { nombre: texto } },
        ...(verCotizacion ? [{ cotizacion: { asunto: texto, ...(typeof verCotizacion === "string" ? { creadoPorId: verCotizacion } : {}) } }] : [])] }) } };
}
function agrupar(datos: EtapaTablero[], campo: "area" | "responsable"): GrupoEtapas[] {
  const grupos = new Map<string | null, GrupoEtapas>();
  for (const etapa of datos) {
    const referencia = etapa[campo];
    const id = referencia?.id ?? null;
    if (!grupos.has(id)) grupos.set(id, { id, nombre: referencia?.nombre ?? "Sin responsable", etapas: [] });
    grupos.get(id)!.etapas.push(etapa);
  }
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || (a.id ?? "").localeCompare(b.id ?? ""));
}
export async function obtenerTablero(consulta: ConsultaTablero, actor: Actor): Promise<TableroProduccion> {
  exigir(actor, "produccion:ver");
  const where = filtroTablero(consulta, can(actor, "cotizacion:ver") && (can(actor, "cotizacion:ver_todas") || actor.id));
  if (soloEtapasPropias(actor)) where.id = { in: await idsEtapasDisponibles(prisma, actor) };
  const [filas, total] = await Promise.all([
    prisma.etapaOrden.findMany({ where, include: { ...incluirEtapa,
      orden: { select: { id: true, numero: true, estado: true, fechaEntrega: true } } },
      orderBy: [{ orden: { fechaEntrega: "asc" } }, { ordenId: "asc" }, { secuencia: "asc" }], take: LIMITE_TABLERO }),
    prisma.etapaOrden.count({ where }),
  ]);
  const hoy = hoyManagua();
  const datos: EtapaTablero[] = filas.map((fila) => ({ ...aEtapaDto(fila),
    orden: { ...fila.orden, fechaEntrega: fila.orden.fechaEntrega.toISOString().slice(0, 10) },
    atrasada: Boolean(fila.fechaFinPlan && fila.fechaFinPlan.toISOString().slice(0, 10) < hoy) }));
  // Las etapas de porArea y porResponsable son las mismas referencias de datos: no se copian.
  return { datos, porArea: agrupar(datos, "area"), porResponsable: agrupar(datos, "responsable"), total, pagina: 1 };
}
export async function opcionesProduccion(actor: Actor): Promise<OpcionesProduccion> {
  exigir(actor, "produccion:ver");
  const [areas, responsables, categorias] = await Promise.all([
    consultarAreasProduccion(), consultarResponsables(),
    prisma.categoria.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
  ]);
  return { areas: areas.map(aAreaDto), responsables, categorias };
}
