import { exigir, type Actor } from "@/core/autorizacion";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { hoyManagua } from "@/modules/cotizaciones/fechas";
import { consultarResponsables } from "@/modules/ordenes/repo";
import { aAreaDto, aEtapaDto } from "./dto";
import { incluirEtapa } from "./repo";
import type { ConsultaTablero } from "./schema";
import type { EtapaTablero, GrupoEtapas, OpcionesProduccion, TableroProduccion } from "./tipos";

function filtroTablero(consulta: ConsultaTablero): Prisma.EtapaOrdenWhereInput {
  const texto = consulta.q ? { contains: consulta.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } : undefined;
  return { estado: consulta.estado ?? { in: ["PENDIENTE", "EN_CURSO"] }, areaId: consulta.area, responsableId: consulta.responsable,
    orden: { estado: { notIn: ["ENTREGADA", "CERRADA", "CANCELADA"] },
      ...(texto && { OR: [{ numero: texto }, { cotizacion: { asunto: texto } }, { cotizacion: { cliente: { nombre: texto } } }] }) } };
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
  const filas = await prisma.etapaOrden.findMany({ where: filtroTablero(consulta), include: { ...incluirEtapa,
    orden: { select: { id: true, numero: true, estado: true, fechaEntrega: true } } },
    orderBy: [{ orden: { fechaEntrega: "asc" } }, { ordenId: "asc" }, { secuencia: "asc" }] });
  const hoy = hoyManagua();
  const datos: EtapaTablero[] = filas.map((fila) => ({ ...aEtapaDto(fila),
    orden: { ...fila.orden, fechaEntrega: fila.orden.fechaEntrega.toISOString().slice(0, 10) },
    atrasada: Boolean(fila.fechaFinPlan && fila.fechaFinPlan.toISOString().slice(0, 10) < hoy) }));
  return { datos, porArea: agrupar(datos, "area"), porResponsable: agrupar(datos, "responsable"), total: datos.length, pagina: 1 };
}
export async function opcionesProduccion(actor: Actor): Promise<OpcionesProduccion> {
  exigir(actor, "produccion:ver");
  const [areas, responsables, categorias] = await Promise.all([
    prisma.area.findMany({ orderBy: [{ nombre: "asc" }, { id: "asc" }] }), consultarResponsables(),
    prisma.categoria.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
  ]);
  return { areas: areas.map(aAreaDto), responsables, categorias };
}
