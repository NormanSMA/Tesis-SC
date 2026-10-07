import { Prisma } from "@/generated/prisma/client";
import { registrarEvento } from "@/lib/bitacora";
import type { Actor } from "@/core/autorizacion";
import type { Tx } from "@/lib/db";
import { aPlantillaDto } from "./dto";
import { campoInvalido, conflictoEdicion, noEncontrado, regla } from "./errores";
import { incluirPlantilla, type PlantillaGuardada } from "./repo";

export async function tomarCategoria(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM categoria WHERE id = ${id}::uuid FOR UPDATE`;
  const categoria = await tx.categoria.findUnique({ where: { id } });
  if (!categoria) throw noEncontrado("categoría");
  return categoria;
}
export async function categoriaDePlantilla(tx: Tx, id: string) {
  const [fila] = await tx.$queryRaw<{ id: string }[]>`SELECT c.id FROM categoria c
    JOIN etapa_plantilla p ON p.categoria_id = c.id WHERE p.id = ${id}::uuid FOR UPDATE OF c`;
  if (!fila) throw noEncontrado("plantilla");
  return fila.id;
}
export function leerPlantillas(tx: Tx, categoriaId: string) {
  return tx.etapaPlantilla.findMany({ where: { categoriaId }, include: incluirPlantilla, orderBy: [{ secuencia: "asc" }, { id: "asc" }] });
}
type CambiosPlantilla = { nombre?: string; areaId?: string; secuencia?: number; activo?: boolean };
const COLUMNAS = { nombre: "nombre", areaId: "area_id", secuencia: "secuencia", activo: "activo" };
export async function actualizarPlantilla(tx: Tx, actual: PlantillaGuardada, cambios: CambiosPlantilla) {
  const asignaciones = Object.entries(cambios).map(([campo, valor]) => {
    const columna = Prisma.raw(COLUMNAS[campo as keyof CambiosPlantilla]);
    return campo === "areaId" ? Prisma.sql`${columna} = ${valor}::uuid` : Prisma.sql`${columna} = ${valor}`;
  });
  const afectadas = await tx.$executeRaw`UPDATE etapa_plantilla SET ${Prisma.join(asignaciones)}, actualizado_en = GREATEST(
    date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', actualizado_en) + interval '1 millisecond')
    WHERE id = ${actual.id}::uuid AND activo = ${actual.activo}
      AND actualizado_en >= ${actual.actualizadoEn}::timestamptz
      AND actualizado_en < ${actual.actualizadoEn}::timestamptz + interval '1 millisecond'`;
  if (afectadas !== 1) throw conflictoEdicion();
  return tx.etapaPlantilla.findUniqueOrThrow({ where: { id: actual.id }, include: incluirPlantilla });
}
export async function registrarPlantilla(tx: Tx, datos: { anterior: PlantillaGuardada | null; nueva: PlantillaGuardada; actor: Actor; operacion: string }) {
  await registrarEvento(tx, { entidad: "CATEGORIA", entidadId: datos.nueva.categoriaId, accion: "EDITAR", actorId: datos.actor.id,
    detalle: { operacion: datos.operacion, plantilla: { antes: datos.anterior ? aPlantillaDto(datos.anterior) : null,
      despues: aPlantillaDto(datos.nueva) } } });
}
export function ordenarPlantillas(filas: PlantillaGuardada[], datos: { id: string; posicion: number }) {
  if (datos.posicion > filas.length) throw campoInvalido("secuencia", `Seleccione una posición entre 1 y ${filas.length}.`);
  const otras = filas.filter((fila) => fila.id !== datos.id);
  const elegida = filas.find((fila) => fila.id === datos.id);
  if (!elegida) throw noEncontrado("plantilla");
  otras.splice(datos.posicion - 1, 0, elegida);
  return otras;
}
export async function prepararPosiciones(tx: Tx, filas: PlantillaGuardada[]) {
  const maxima = Math.max(0, ...filas.map((fila) => fila.secuencia));
  if (maxima + filas.length > 2147483647) throw regla("SECUENCIA_FUERA_DE_RANGO", "No quedan posiciones libres para reordenar las plantillas.");
  for (const [indice, fila] of filas.entries()) {
    if (fila.secuencia !== indice + 1) await tx.$executeRaw`UPDATE etapa_plantilla
      SET secuencia = ${maxima + indice + 1} WHERE id = ${fila.id}::uuid`;
  }
}
export async function finalizarPosiciones(tx: Tx, datos: { filas: PlantillaGuardada[]; principalId: string; actor: Actor }) {
  await prepararPosiciones(tx, datos.filas);
  for (const [indice, anterior] of datos.filas.entries()) {
    if (anterior.secuencia === indice + 1) continue;
    const nueva = await actualizarPlantilla(tx, anterior, { secuencia: indice + 1 });
    if (anterior.id !== datos.principalId) await registrarPlantilla(tx, { anterior, nueva, actor: datos.actor, operacion: "REORDENAR" });
  }
}
