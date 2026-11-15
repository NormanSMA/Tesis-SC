import { exigir, type Actor } from "@/core/autorizacion";
import { prisma, type Tx } from "@/lib/db";
import { registrarEvento } from "@/lib/bitacora";
import { AppError } from "@/lib/errores";
import { esquemaCategorias, type CategoriaPersonalizada, type RegistroPersonalizadas, type esquemaGuardar } from "./schema";
import type { z } from "zod";

export const CLAVE_PERSONALIZADAS = "cotizacion_tipos_personalizados";
const fallo = (status: number, mensaje: string) => new AppError({ status, codigo: status === 409 ? "CONFLICTO_EDICION" : "VALIDACION", mensaje });
export async function leerPersonalizadas(): Promise<RegistroPersonalizadas> {
  const fila = await prisma.configuracion.findUnique({ where: { clave: CLAVE_PERSONALIZADAS } });
  return { categorias: fila ? esquemaCategorias.parse(JSON.parse(fila.valor)) : [], version: fila?.actualizadoEn.toISOString() ?? null };
}
async function resolverCategorias(tx: Tx, categorias: CategoriaPersonalizada[], actor: Actor) {
  const resultado: CategoriaPersonalizada[] = [];
  for (const categoria of categorias) {
    let fila = await tx.categoria.findUnique({ where: { id: categoria.id } });
    fila ??= await tx.categoria.findFirst({ where: { nombre: { equals: categoria.nombre, mode: "insensitive" } } });
    if (fila && !fila.activo) throw fallo(422, "La categoría está archivada. Reactívela antes de utilizarla.");
    if (!fila) {
      fila = await tx.categoria.create({ data: { id: categoria.id, nombre: categoria.nombre } });
      await registrarEvento(tx, { entidad: "CATEGORIA", entidadId: fila.id, accion: "CREAR", actorId: actor.id,
        detalle: { nombre: fila.nombre, origen: "cotizaciones personalizadas" } });
    }
    resultado.push({ ...categoria, id: fila.id, nombre: fila.nombre });
  }
  if (new Set(resultado.map(c => c.id)).size !== resultado.length) throw fallo(422, "Hay categorías duplicadas.");
  return resultado;
}
export async function guardarPersonalizadas(entrada: z.infer<typeof esquemaGuardar>, actor: Actor) {
  exigir(actor, "tarifa:gestionar");
  return prisma.$transaction(async tx => {
    // La fila aún puede no existir; el bloqueo serializa también la primera creación.
    await tx.$queryRaw`SELECT true AS bloqueado FROM pg_advisory_xact_lock(hashtext('cotizacion_tipos_personalizados'))`;
    const actual = await tx.configuracion.findUnique({ where: { clave: CLAVE_PERSONALIZADAS } });
    if ((actual?.actualizadoEn.toISOString() ?? null) !== entrada.version) throw fallo(409, "La configuración cambió. Recargue antes de guardar.");
    const ids = [...new Set(entrada.categorias.flatMap(c => c.tipos.flatMap(t => t.materiales)))];
    if (await tx.material.count({ where: { id: { in: ids }, activo: true } }) !== ids.length) throw fallo(422, "Seleccione materiales activos registrados.");
    const categorias = await resolverCategorias(tx, entrada.categorias, actor);
    const datos = { valor: JSON.stringify(categorias), actualizadoPorId: actor.id,
      actualizadoEn: new Date(Math.max(Date.now(), (actual?.actualizadoEn.getTime() ?? 0) + 1)) };
    const fila = actual ? await tx.configuracion.update({ where: { id: actual.id }, data: datos })
      : await tx.configuracion.create({ data: { ...datos, clave: CLAVE_PERSONALIZADAS, tipo: "TEXTO", descripcion: "Tipos de cotización personalizada" } });
    await registrarEvento(tx, { entidad: "CONFIGURACION", entidadId: fila.id, accion: actual ? "EDITAR" : "CREAR", actorId: actor.id,
      detalle: { clave: CLAVE_PERSONALIZADAS, anterior: actual?.valor ?? null, nuevo: fila.valor } });
    return { categorias, version: fila.actualizadoEn.toISOString() };
  });
}
