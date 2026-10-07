import { exigir, type Actor } from "@/core/autorizacion";
import type { Area } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { aAreaDto } from "./dto";
import { conflictoEdicion, exigirVersion, noEncontrado, regla } from "./errores";
import { transaccionProduccion } from "./escritura";
import type { EntradaCrearArea, EntradaEditarArea, EntradaVersion } from "./schema";

export async function listarAreas(actor: Actor) {
  exigir(actor, "produccion:ver");
  return (await prisma.area.findMany({ orderBy: [{ nombre: "asc" }, { id: "asc" }] })).map(aAreaDto);
}
export async function crearArea(entrada: EntradaCrearArea, actor: Actor) {
  exigir(actor, "catalogo:gestionar");
  return transaccionProduccion(async (tx) => {
    const area = await tx.area.create({ data: entrada });
    await registrarEvento(tx, { entidad: "AREA", entidadId: area.id, accion: "CREAR", actorId: actor.id,
      detalle: { nombre: area.nombre } });
    return aAreaDto(area);
  });
}
async function tomarArea(tx: Tx, datos: { id: string; version: string }) {
  await tx.$queryRaw`SELECT id FROM area WHERE id = ${datos.id}::uuid FOR UPDATE`;
  const area = await tx.area.findUnique({ where: { id: datos.id } });
  if (!area) throw noEncontrado("área");
  exigirVersion(area, datos.version);
  return area;
}
async function actualizarArea(tx: Tx, actual: Area, cambios: { nombre?: string; activo?: boolean }) {
  const asignaciones = Object.entries(cambios).map(([campo, valor]) => Prisma.sql`${Prisma.raw(campo)} = ${valor}`);
  const afectadas = await tx.$executeRaw`UPDATE area SET ${Prisma.join(asignaciones)}, actualizado_en = GREATEST(
    date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${actual.id}::uuid AND activo = ${actual.activo}
      AND actualizado_en >= ${actual.actualizadoEn}::timestamptz
      AND actualizado_en < ${actual.actualizadoEn}::timestamptz + interval '1 millisecond'`;
  if (afectadas !== 1) throw conflictoEdicion();
  return tx.area.findUniqueOrThrow({ where: { id: actual.id } });
}
export async function editarArea(id: string, entrada: EntradaEditarArea, actor: Actor) {
  exigir(actor, "catalogo:gestionar");
  return transaccionProduccion(async (tx) => {
    const actual = await tomarArea(tx, { id, version: entrada.version });
    if (actual.nombre === entrada.nombre) return aAreaDto(actual);
    const nueva = await actualizarArea(tx, actual, { nombre: entrada.nombre });
    await registrarEvento(tx, { entidad: "AREA", entidadId: id, accion: "EDITAR", actorId: actor.id,
      detalle: { nombre: { anterior: actual.nombre, nuevo: nueva.nombre } } });
    return aAreaDto(nueva);
  });
}
async function exigirAreaLibre(tx: Tx, id: string) {
  const plantillas = await tx.etapaPlantilla.count({ where: { areaId: id, activo: true } });
  const etapas = await tx.etapaOrden.count({ where: { areaId: id, estado: { in: ["PENDIENTE", "EN_CURSO"] },
    orden: { estado: { notIn: ["ENTREGADA", "CERRADA", "CANCELADA"] } } } });
  if (plantillas || etapas) throw regla("AREA_EN_USO", "El área tiene plantillas activas o etapas abiertas de órdenes no terminales.");
}
async function cambiarActivo(datos: { id: string; entrada: EntradaVersion; actor: Actor; activo: boolean }) {
  exigir(datos.actor, "catalogo:gestionar");
  return transaccionProduccion(async (tx) => {
    const actual = await tomarArea(tx, { id: datos.id, version: datos.entrada.version });
    if (actual.activo === datos.activo) return aAreaDto(actual);
    if (!datos.activo) await exigirAreaLibre(tx, datos.id);
    const nueva = await actualizarArea(tx, actual, { activo: datos.activo });
    await registrarEvento(tx, { entidad: "AREA", entidadId: datos.id, accion: datos.activo ? "REACTIVAR" : "ARCHIVAR",
      actorId: datos.actor.id, detalle: { activo: { anterior: actual.activo, nuevo: nueva.activo } } });
    return aAreaDto(nueva);
  });
}
export function archivarArea(id: string, entrada: EntradaVersion, actor: Actor) { return cambiarActivo({ id, entrada, actor, activo: false }); }
export function reactivarArea(id: string, entrada: EntradaVersion, actor: Actor) { return cambiarActivo({ id, entrada, actor, activo: true }); }
