import { can, type Actor } from "@/core/autorizacion";
import { costearLinea } from "@/core/costeo";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { aFichaProducto, type FilaFicha } from "./dto";
import { conflictoEdicion, exigirVersion } from "./errores";
import { actualizarProducto } from "./repo";
import type { EntradaReceta } from "./schema";
import { exigirProducto, exigirProductoActivo } from "./service";

async function validarMateriales(tx: Tx, actual: FilaFicha, entrada: EntradaReceta) {
  const ids = entrada.materiales.map((fila) => fila.materialId);
  const materiales = await tx.material.findMany({ where: { id: { in: ids } } });
  const existentes = new Set(actual.receta.map((fila) => fila.materialId));
  const campos: Record<string, string> = {};
  entrada.materiales.forEach((fila, indice) => {
    const material = materiales.find((material) => material.id === fila.materialId);
    if (!material) campos[`materiales.${indice}.materialId`] = "El material no existe.";
    else if (!material.activo && !existentes.has(material.id)) {
      campos[`materiales.${indice}.materialId`] = "No se puede agregar un material archivado.";
    }
  });
  if (Object.keys(campos).length) throw new AppError({ codigo: "VALIDACION", status: 422,
    mensaje: "Hay materiales con errores.", campos });
}
export function reemplazarReceta(id: string, entrada: EntradaReceta, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const actual = await exigirProducto(tx, id);
    exigirVersion(actual, entrada.version);
    exigirProductoActivo(actual);
    if (!await actualizarProducto(tx, { id, activo: true, version: entrada.version }, {})) throw conflictoEdicion();
    await validarMateriales(tx, actual, entrada);
    const nuevo = entrada.materiales.map((fila) => ({ materialId: fila.materialId,
      cantidad: costearLinea({ tipo: "MATERIAL", cantidad: fila.cantidad, costoUnitario: "0", mermaPct: "0" }).cantidad,
    })).sort((a, b) => a.materialId.localeCompare(b.materialId));
    const anterior = actual.receta.map((fila) => ({ materialId: fila.materialId, cantidad: fila.cantidad.toFixed(3) }));
    await tx.recetaProducto.deleteMany({ where: { productoId: id } });
    if (nuevo.length) await tx.recetaProducto.createMany({ data: nuevo.map((fila) => ({ ...fila, productoId: id })) });
    await registrarEvento(tx, { entidad: "PRODUCTO", entidadId: id, accion: "EDITAR", actorId: actor.id,
      detalle: { cambios: { materiales: { anterior, nuevo } } } });
    return aFichaProducto(await exigirProducto(tx, id), can(actor, "cotizacion:ver"));
  });
}
