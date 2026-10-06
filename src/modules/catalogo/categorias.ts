import type { Actor } from "@/core/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { prisma } from "@/lib/db";

import { aCategoriaDto, aMaterialDto } from "./dto";
import { conflictoEdicion, exigirVersion, noEncontrado, traducirDuplicado } from "./errores";
import { actualizarCategoria, consultarCategorias, consultarMateriales, type CambiosCategoria } from "./repo";
import { CAMPOS_CATEGORIA, type ConsultaCategorias, type ConsultaMateriales, type EntradaCrearCategoria, type EntradaEditarCategoria } from "./schema";

export async function listarCategorias(consulta: ConsultaCategorias = { activo: undefined }) {
  return (await consultarCategorias(consulta)).map(aCategoriaDto);
}
export async function listarMateriales(consulta: ConsultaMateriales) {
  return (await consultarMateriales(consulta)).map(aMaterialDto);
}
export async function crearCategoria(entrada: EntradaCrearCategoria, actor: Actor) {
  try {
    return await prisma.$transaction(async (tx) => {
      const categoria = await tx.categoria.create({ data: entrada });
      await registrarEvento(tx, { entidad: "CATEGORIA", entidadId: categoria.id, accion: "CREAR",
        actorId: actor.id, estadoNuevo: "ACTIVO", detalle: { nombre: categoria.nombre } });
      return aCategoriaDto(categoria);
    });
  } catch (error) { throw traducirDuplicado(error, "nombre"); }
}
export async function editarCategoria(id: string, entrada: EntradaEditarCategoria, actor: Actor) {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.categoria.findUnique({ where: { id } });
      if (!actual) throw noEncontrado("categoría");
      exigirVersion(actual, entrada.version);
      const cambios: CambiosCategoria = {};
      const detalle: Record<string, { anterior: string | boolean | null; nuevo: string | boolean | null }> = {};
      for (const campo of CAMPOS_CATEGORIA) {
        const nuevo = entrada[campo];
        if (nuevo === undefined || nuevo === actual[campo]) continue;
        cambios[campo] = nuevo;
        detalle[campo] = { anterior: actual[campo], nuevo };
      }
      if (!Object.keys(cambios).length) return aCategoriaDto(actual);
      if (!await actualizarCategoria(tx, { id, activo: actual.activo, version: entrada.version }, cambios)) throw conflictoEdicion();
      await registrarEvento(tx, { entidad: "CATEGORIA", entidadId: id, actorId: actor.id,
        accion: cambios.activo === undefined ? "EDITAR" : cambios.activo ? "REACTIVAR" : "ARCHIVAR",
        estadoAnterior: cambios.activo === undefined ? undefined : actual.activo ? "ACTIVO" : "ARCHIVADO",
        estadoNuevo: cambios.activo === undefined ? undefined : cambios.activo ? "ACTIVO" : "ARCHIVADO",
        detalle: { cambios: detalle } });
      return aCategoriaDto(await tx.categoria.findUniqueOrThrow({ where: { id } }));
    });
  } catch (error) { throw traducirDuplicado(error, "nombre"); }
}
