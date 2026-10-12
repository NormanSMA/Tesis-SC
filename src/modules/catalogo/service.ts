import { can, type Actor } from "@/core/autorizacion";
import { costearItemCatalogo } from "@/core/costeo";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { aFichaProducto, aProductoDto, type FilaFicha } from "./dto";
import { conflictoEdicion, exigirVersion, noEncontrado, traducirDuplicado } from "./errores";
import { actualizarProducto, buscarProducto, consultarProductos, insertarProducto, type CambiosProducto } from "./repo";
import { CAMPOS_PRODUCTO, type ConsultaProductos, type EntradaCrearProducto, type EntradaEditarProducto } from "./schema";

export { leerId as leerIdProducto } from "./errores";

export async function exigirProducto(tx: Tx, id: string): Promise<FilaFicha> {
  const actual = await buscarProducto(tx, id);
  if (!actual) throw noEncontrado();
  return actual;
}
export function exigirProductoActivo(actual: FilaFicha): void {
  if (!actual.activo) throw new AppError({ codigo: "PRODUCTO_ARCHIVADO", status: 409,
    mensaje: "Un producto archivado no se puede editar. Reactívelo primero." });
}
function precioNormalizado(precioBase: string): string {
  return costearItemCatalogo({ unidadCobro: "UNIDAD", cantidad: "1", precioBase }).precioUnitario;
}
function valorAnterior(actual: FilaFicha, campo: (typeof CAMPOS_PRODUCTO)[number]): string | null {
  if (campo === "precioBase") return actual.precioBase.toFixed(2);
  if (campo === "costoUnitario") return actual.costoUnitario?.toFixed(4) ?? null;
  return actual[campo];
}
function cambiosProducto(actual: FilaFicha, entrada: EntradaEditarProducto): CambiosProducto {
  const cambios: CambiosProducto = {};
  for (const campo of CAMPOS_PRODUCTO) {
    const nuevo = campo === "precioBase" && entrada.precioBase !== undefined ? precioNormalizado(entrada.precioBase) : entrada[campo];
    const anterior = valorAnterior(actual, campo);
    if (nuevo !== undefined && nuevo !== anterior) cambios[campo] = nuevo;
  }
  return cambios;
}
function detalleCambios(actual: FilaFicha, cambios: CambiosProducto) {
  const detalle: Record<string, { anterior: string | null; nuevo: string | boolean | null }> = {};
  for (const campo of CAMPOS_PRODUCTO) {
    if (cambios[campo] === undefined) continue;
    const anterior = valorAnterior(actual, campo);
    detalle[campo] = { anterior, nuevo: cambios[campo] ?? null };
  }
  return { cambios: detalle };
}
export async function crearProducto(entrada: EntradaCrearProducto, actor: Actor) {
  try {
    return await prisma.$transaction(async (tx) => {
      const producto = await insertarProducto(tx, { ...entrada, precioBase: precioNormalizado(entrada.precioBase) });
      await registrarEvento(tx, { entidad: "PRODUCTO", entidadId: producto.id, accion: "CREAR",
        actorId: actor.id, estadoNuevo: "ACTIVO", detalle: { codigo: producto.codigo, nombre: producto.nombre,
          costoUnitario: producto.costoUnitario?.toFixed(4) ?? null } });
      return aProductoDto(producto, can(actor, "cotizacion:ver"));
    });
  } catch (error) { throw traducirDuplicado(error, "codigo"); }
}
export async function editarProducto(id: string, entrada: EntradaEditarProducto, actor: Actor) {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await exigirProducto(tx, id);
      exigirVersion(actual, entrada.version);
      exigirProductoActivo(actual);
      const cambios = cambiosProducto(actual, entrada);
      if (!Object.keys(cambios).length) return aProductoDto(actual, can(actor, "cotizacion:ver"));
      if (!await actualizarProducto(tx, { id, activo: true, version: entrada.version }, cambios)) throw conflictoEdicion();
      await registrarEvento(tx, { entidad: "PRODUCTO", entidadId: id, accion: "EDITAR", actorId: actor.id,
        detalle: detalleCambios(actual, cambios) });
      return aProductoDto(await exigirProducto(tx, id), can(actor, "cotizacion:ver"));
    });
  } catch (error) { throw traducirDuplicado(error, "codigo"); }
}
function cambiarActivo(peticion: { id: string; activo: boolean; version: string; actor: Actor }) {
  const { id, activo, version, actor } = peticion;
  return prisma.$transaction(async (tx) => {
    const actual = await exigirProducto(tx, id);
    exigirVersion(actual, version);
    if (actual.activo === activo) throw new AppError({ codigo: activo ? "PRODUCTO_ACTIVO" : "PRODUCTO_ARCHIVADO",
      mensaje: activo ? "El producto ya está activo." : "El producto ya está archivado.", status: 409 });
    if (!await actualizarProducto(tx, { id, activo: !activo, version }, { activo })) throw conflictoEdicion();
    await registrarEvento(tx, { entidad: "PRODUCTO", entidadId: id, accion: activo ? "REACTIVAR" : "ARCHIVAR",
      actorId: actor.id, estadoAnterior: activo ? "ARCHIVADO" : "ACTIVO", estadoNuevo: activo ? "ACTIVO" : "ARCHIVADO" });
    return aProductoDto(await exigirProducto(tx, id), can(actor, "cotizacion:ver"));
  });
}
export function archivarProducto(id: string, version: string, actor: Actor) {
  return cambiarActivo({ id, version, actor, activo: false });
}
export function reactivarProducto(id: string, version: string, actor: Actor) {
  return cambiarActivo({ id, version, actor, activo: true });
}
export async function listarProductos(consulta: ConsultaProductos, actor?: Actor) {
  const { filas, total } = await consultarProductos(consulta);
  return { datos: filas.map((fila) => aProductoDto(fila, !!actor && can(actor, "cotizacion:ver"))), total, pagina: consulta.pagina, porPagina: consulta.porPagina };
}
export async function obtenerProducto(id: string, actor?: Actor) {
  return aFichaProducto(await exigirProducto(prisma, id), !!actor && can(actor, "cotizacion:ver"),
    !!actor && (can(actor, "cotizacion:ver") || can(actor, "inventario:ver")));
}
