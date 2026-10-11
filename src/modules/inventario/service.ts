import { can, exigir, type Actor } from "@/core/autorizacion";
import { CERO, comparar, leerDecimal } from "@/core/decimal";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { aMaterialDto, aMovimientoDto, type ListaMateriales, type ListaMovimientos } from "./dto";
import { conflictoEdicion, exigirVersion, noEncontrado, regla, traducirError } from "./errores";
import { actualizarCondicionado, bloquearMaterial, consultarConciliacion, consultarMateriales, consultarMovimientos, consultarOpcionesLibro,
  type CambiosMaterial, type SeleccionLibro } from "./repo";
import type { ConsultaMateriales, ConsultaMovimientos, CrearMaterial, EditarMaterial } from "./schema";
import { alertaMaterial } from "./reglas";

export { leerIdMaterial } from "./errores";
export { registrarEntrada, registrarAjuste } from "./libro";
export async function transaccionInventario<T>(ejecutar: (tx: Tx) => Promise<T>): Promise<T> {
  try { return await prisma.$transaction(ejecutar); } catch (error) { traducirError(error); }
}
export async function listarMateriales(consulta: ConsultaMateriales, actor: Actor): Promise<ListaMateriales> {
  exigir(actor, "inventario:ver");
  const { filas, total, resumen } = await consultarMateriales(consulta);
  return { datos: filas.map(aMaterialDto), total, resumen, pagina: consulta.pagina, porPagina: consulta.porPagina };
}
export async function obtenerMaterial(id: string, actor: Actor) {
  exigir(actor, "inventario:ver");
  const actual = await prisma.material.findUnique({ where: { id } });
  if (!actual) throw noEncontrado();
  const conciliacion = await consultarConciliacion(id);
  if (!conciliacion.conciliado) console.error("Diferencia de integridad del libro de inventario", { materialId: id, conciliacion });
  const datos = { ...aMaterialDto(actual), existencia: conciliacion.existencia };
  return { ...datos, alerta: alertaMaterial(datos), conciliacion };
}
export async function crearMaterial(entrada: CrearMaterial, actor: Actor) {
  exigir(actor, "material:gestionar");
  return transaccionInventario(async (tx) => {
    const material = await tx.material.create({ data: entrada });
    const datos = aMaterialDto(material);
    await registrarEvento(tx, { entidad: "MATERIAL", entidadId: material.id, accion: "CREAR", actorId: actor.id,
      estadoNuevo: "ACTIVO", detalle: { material: datos } });
    return datos;
  });
}
export async function editarMaterial(id: string, entrada: EditarMaterial, actor: Actor) {
  exigir(actor, "material:gestionar");
  return transaccionInventario(async (tx) => {
    const actual = await bloquearMaterial(tx, id);
    exigirVersion(actual, entrada.version);
    if (entrada.costoPromedio !== undefined && comparar(leerDecimal(entrada.costoPromedio)!, leerDecimal(actual.costoPromedio.toString())!) !== 0
      && comparar(leerDecimal(actual.existencia.toString())!, CERO) !== 0) {
      throw regla("MATERIAL_CON_EXISTENCIA", "El costo promedio solo se puede editar con existencia cero.");
    }
    const antes = aMaterialDto(actual);
    const cambios: CambiosMaterial = {};
    for (const campo of ["nombre", "descripcion", "stockMinimo", "costoPromedio"] as const) {
      const valor = entrada[campo];
      if (valor === undefined) continue;
      const igual = (campo === "stockMinimo" || campo === "costoPromedio")
        ? comparar(leerDecimal(valor as string)!, leerDecimal(antes[campo])!) === 0 : valor === antes[campo];
      if (!igual) Object.assign(cambios, { [campo]: valor });
    }
    if (!Object.keys(cambios).length) return antes;
    if (!await actualizarCondicionado(tx, { id, version: entrada.version }, cambios)) throw conflictoEdicion();
    const despues = aMaterialDto(await tx.material.findUniqueOrThrow({ where: { id } }));
    await registrarEvento(tx, { entidad: "MATERIAL", entidadId: id, accion: "EDITAR", actorId: actor.id,
      detalle: { antes, despues } });
    return despues;
  });
}
export async function cambiarActivoMaterial(entrada: { id: string; version: string; activo: boolean }, actor: Actor) {
  exigir(actor, "material:gestionar");
  return transaccionInventario(async (tx) => {
    const actual = await bloquearMaterial(tx, entrada.id);
    exigirVersion(actual, entrada.version);
    if (!entrada.activo && comparar(leerDecimal(actual.existencia.toString())!, CERO) !== 0) {
      throw regla("MATERIAL_CON_EXISTENCIA", "El material tiene existencia. Registre su salida antes de archivarlo.");
    }
    if (actual.activo === entrada.activo) return aMaterialDto(actual);
    if (!await actualizarCondicionado(tx, entrada, { activo: entrada.activo })) throw conflictoEdicion();
    await registrarEvento(tx, { entidad: "MATERIAL", entidadId: entrada.id, actorId: actor.id,
      accion: entrada.activo ? "REACTIVAR" : "ARCHIVAR", estadoAnterior: actual.activo ? "ACTIVO" : "ARCHIVADO",
      estadoNuevo: entrada.activo ? "ACTIVO" : "ARCHIVADO", detalle: { material: actual.nombre } });
    return aMaterialDto(await tx.material.findUniqueOrThrow({ where: { id: entrada.id } }));
  });
}
export async function listarMovimientos(consulta: ConsultaMovimientos, actor: Actor): Promise<ListaMovimientos> {
  exigir(actor, "inventario:ver");
  const { filas, total } = await consultarMovimientos(consulta);
  return { datos: filas.map((fila) => aMovimientoDto(fila, actor)), total, pagina: consulta.pagina, porPagina: consulta.porPagina };
}
export async function listarMovimientosMaterial(id: string, consulta: ConsultaMovimientos, actor: Actor) {
  exigir(actor, "inventario:ver");
  if (!await prisma.material.findUnique({ where: { id }, select: { id: true } })) throw noEncontrado();
  return listarMovimientos({ ...consulta, material: id }, actor);
}
export function opcionesLibro(actor: Actor, seleccion: SeleccionLibro = {}) {
  exigir(actor, "inventario:ver");
  return consultarOpcionesLibro(can(actor, "orden:ver"), seleccion);
}
