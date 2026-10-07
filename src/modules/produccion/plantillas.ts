import { exigir, type Actor } from "@/core/autorizacion";
import { prisma } from "@/lib/db";
import { aPlantillaDto } from "./dto";
import { campoInvalido, exigirVersion, noEncontrado } from "./errores";
import { transaccionProduccion } from "./escritura";
import { actualizarPlantilla, categoriaDePlantilla, finalizarPosiciones, leerPlantillas, ordenarPlantillas, registrarPlantilla, tomarCategoria } from "./plantillas-repo";
import { incluirPlantilla, validarArea } from "./repo";
import type { EntradaCrearPlantilla, EntradaEditarPlantilla, EntradaVersion } from "./schema";

export async function listarPlantillas(categoriaId: string, actor: Actor) {
  exigir(actor, "produccion:ver");
  if (!await prisma.categoria.findUnique({ where: { id: categoriaId }, select: { id: true } })) throw noEncontrado("categoría");
  return (await leerPlantillas(prisma, categoriaId)).map(aPlantillaDto);
}
export async function crearPlantilla(categoriaId: string, entrada: EntradaCrearPlantilla, actor: Actor) {
  exigir(actor, "catalogo:gestionar");
  return transaccionProduccion(async (tx) => {
    const categoria = await tomarCategoria(tx, categoriaId);
    if (!categoria.activo) throw campoInvalido("categoriaId", "Seleccione una categoría activa.");
    await validarArea(tx, entrada.areaId);
    const anteriores = await leerPlantillas(tx, categoriaId);
    const posicion = entrada.secuencia ?? anteriores.length + 1;
    if (posicion > anteriores.length + 1) throw campoInvalido("secuencia", "Seleccione una posición disponible.");
    const plantilla = await tx.etapaPlantilla.create({ data: { categoriaId, nombre: entrada.nombre, areaId: entrada.areaId,
      secuencia: Math.max(0, ...anteriores.map((fila) => fila.secuencia)) + 1 }, include: incluirPlantilla });
    const filas = ordenarPlantillas([...anteriores, plantilla], { id: plantilla.id, posicion });
    await finalizarPosiciones(tx, { filas, principalId: plantilla.id, actor });
    const nueva = await tx.etapaPlantilla.findUniqueOrThrow({ where: { id: plantilla.id }, include: incluirPlantilla });
    await registrarPlantilla(tx, { anterior: null, nueva, actor, operacion: "CREAR" });
    return aPlantillaDto(nueva);
  });
}
export async function editarPlantilla(id: string, entrada: EntradaEditarPlantilla, actor: Actor) {
  exigir(actor, "catalogo:gestionar");
  return transaccionProduccion(async (tx) => {
    const categoriaId = await categoriaDePlantilla(tx, id);
    const anteriores = await leerPlantillas(tx, categoriaId);
    const actual = anteriores.find((fila) => fila.id === id)!;
    exigirVersion(actual, entrada.version);
    const cambios = { ...(entrada.nombre !== undefined && entrada.nombre !== actual.nombre && { nombre: entrada.nombre }),
      ...(entrada.areaId !== undefined && entrada.areaId !== actual.areaId && { areaId: entrada.areaId }) };
    const reordenar = entrada.secuencia !== undefined && entrada.secuencia !== actual.secuencia;
    if (!Object.keys(cambios).length && !reordenar) return aPlantillaDto(actual);
    await validarArea(tx, entrada.areaId ?? actual.areaId);
    if (reordenar) await finalizarPosiciones(tx, { filas: ordenarPlantillas(anteriores, { id, posicion: entrada.secuencia! }), principalId: id, actor });
    if (Object.keys(cambios).length) {
      const vigente = await tx.etapaPlantilla.findUniqueOrThrow({ where: { id }, include: incluirPlantilla });
      await actualizarPlantilla(tx, vigente, cambios);
    }
    const nueva = await tx.etapaPlantilla.findUniqueOrThrow({ where: { id }, include: incluirPlantilla });
    await registrarPlantilla(tx, { anterior: actual, nueva, actor, operacion: reordenar ? "REORDENAR" : "EDITAR" });
    return aPlantillaDto(nueva);
  });
}
export async function archivarPlantilla(id: string, entrada: EntradaVersion, actor: Actor) {
  exigir(actor, "catalogo:gestionar");
  return transaccionProduccion(async (tx) => {
    await categoriaDePlantilla(tx, id);
    const actual = await tx.etapaPlantilla.findUniqueOrThrow({ where: { id }, include: incluirPlantilla });
    exigirVersion(actual, entrada.version);
    if (!actual.activo) return aPlantillaDto(actual);
    const nueva = await actualizarPlantilla(tx, actual, { activo: false });
    await registrarPlantilla(tx, { anterior: actual, nueva, actor, operacion: "ARCHIVAR" });
    return aPlantillaDto(nueva);
  });
}
