import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { campoInvalido, conflictoEdicion, noEncontrado } from "./errores";

export const incluirEtapa = { area: { select: { id: true, nombre: true } }, responsable: { select: { id: true, nombre: true } } };
export type EtapaGuardada = Prisma.EtapaOrdenGetPayload<{ include: typeof incluirEtapa }>;
export const incluirPlantilla = { area: { select: { id: true, nombre: true } } };
export type PlantillaGuardada = Prisma.EtapaPlantillaGetPayload<{ include: typeof incluirPlantilla }>;
export async function bloquearOrden(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM orden_trabajo WHERE id = ${id}::uuid FOR UPDATE`;
  const orden = await tx.ordenTrabajo.findUnique({ where: { id } });
  if (!orden) throw noEncontrado("orden");
  return orden;
}
export async function bloquearEtapa(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM etapa_orden WHERE id = ${id}::uuid FOR UPDATE`;
  return exigirEtapa(tx, id);
}
export async function exigirEtapa(tx: Tx, id: string): Promise<EtapaGuardada> {
  const etapa = await tx.etapaOrden.findUnique({ where: { id }, include: incluirEtapa });
  if (!etapa) throw noEncontrado("etapa");
  return etapa;
}
export async function validarArea(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM area WHERE id = ${id}::uuid FOR SHARE`;
  const area = await tx.area.findUnique({ where: { id } });
  if (!area?.activo) throw campoInvalido("areaId", "Seleccione un área activa.");
  return area;
}
export async function validarResponsable(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${id}::uuid FOR SHARE`;
  const usuario = await tx.usuario.findFirst({ where: { id, activo: true, perfil: { codigo: "PRODUCCION" } } });
  if (!usuario) throw campoInvalido("responsableId", "Seleccione un usuario activo de Producción.");
}
export type CambiosEtapa = { responsableId?: string | null; fechaInicioPlan?: Date | null; fechaFinPlan?: Date | null;
  estado?: string; fechaInicioReal?: Date; fechaFinReal?: Date; observaciones?: string | null };
const COLUMNAS = { responsableId: "responsable_id", fechaInicioPlan: "fecha_inicio_plan", fechaFinPlan: "fecha_fin_plan",
  estado: "estado", fechaInicioReal: "fecha_inicio_real", fechaFinReal: "fecha_fin_real", observaciones: "observaciones" };
export async function actualizarEtapa(tx: Tx, actual: EtapaGuardada, cambios: CambiosEtapa) {
  const asignaciones = Object.entries(cambios).filter(([, valor]) => valor !== undefined).map(([campo, valor]) => {
    const columna = Prisma.raw(COLUMNAS[campo as keyof CambiosEtapa]);
    if (campo === "estado") return Prisma.sql`${columna} = ${valor}::estado_etapa`;
    if (campo === "responsableId") return Prisma.sql`${columna} = ${valor}::uuid`;
    return Prisma.sql`${columna} = ${valor}`;
  });
  const afectadas = await tx.$executeRaw`UPDATE etapa_orden SET ${Prisma.join(asignaciones)}, actualizado_en = GREATEST(
    date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${actual.id}::uuid AND estado = ${actual.estado}::estado_etapa
      AND actualizado_en >= ${actual.actualizadoEn}::timestamptz
      AND actualizado_en < ${actual.actualizadoEn}::timestamptz + interval '1 millisecond'`;
  if (afectadas !== 1) throw conflictoEdicion();
  return exigirEtapa(tx, actual.id);
}
