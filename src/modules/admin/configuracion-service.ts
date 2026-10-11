import { exigir, type Actor } from "@/core/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { aConfiguracionDto } from "./configuracion-dto";
import { actualizarConfiguracion, bloquearConfiguracion, consultarConfiguracion } from "./configuracion-repo";
import {
  validarValorConfiguracion, validarVersionConfiguracion, type EntradaEditarConfiguracion,
} from "./configuracion-schema";

export async function listarConfiguracion(actor: Actor) {
  exigir(actor, "configuracion:gestionar");
  return (await consultarConfiguracion(prisma)).map(aConfiguracionDto);
}

export async function editarConfiguracion(entrada: EntradaEditarConfiguracion, actor: Actor) {
  exigir(actor, "configuracion:gestionar");
  return prisma.$transaction(async (tx) => {
    const actual = await bloquearConfiguracion(tx, entrada.clave);
    if (!actual) {
      throw new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El parámetro no existe.", status: 404 });
    }
    const valor = validarValorConfiguracion({ clave: actual.clave, tipo: actual.tipo, valor: entrada.valor });
    validarVersionConfiguracion(actual.actualizadoEn, entrada.version);
    if (valor === actual.valor) return aConfiguracionDto(actual);
    const nuevo = await actualizarConfiguracion(tx, { actual, valor, actorId: actor.id });
    await registrarEvento(tx, {
      entidad: "CONFIGURACION", entidadId: actual.id, accion: "EDITAR", actorId: actor.id,
      detalle: { clave: actual.clave, valor: { anterior: actual.valor, nuevo: valor } },
    });
    return aConfiguracionDto(nuevo);
  });
}
