import { can, exigir, type Actor } from "@/core/autorizacion";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { leerResumenMateriales } from "@/modules/inventario/resumen-orden";
import { noEncontrado } from "@/modules/ordenes/errores";
import { leerCostos } from "./costos";
import { aCadenaDto, aEventoDto, aMaterialesDto, responsablesTrabajo } from "./dto";
import { leerReferencias } from "./referencias";
import { buscarCadena, buscarTrabajo, consultarEventosOrden, consultarGlobal, consultarUsuarios } from "./repo";
import type { ConsultaBitacora } from "./schema";

export async function listarBitacora(consulta: ConsultaBitacora, actor: Actor) {
  exigir(actor, "bitacora:ver");
  return prisma.$transaction(async (tx) => {
    const { eventos, total } = await consultarGlobal(tx, consulta);
    const referencias = await leerReferencias(tx, eventos);
    return { datos: eventos.map((evento) => aEventoDto({ evento, actor, referencias })), total,
      pagina: consulta.pagina, porPagina: consulta.porPagina };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function obtenerTrazabilidad(id: string, actor: Actor) {
  exigir(actor, "orden:ver");
  return prisma.$transaction(async (tx) => {
    const orden = await buscarCadena(tx, id);
    if (!orden) throw noEncontrado();
    const eventos = await consultarEventosOrden(tx, orden);
    const [referencias, materiales, costos] = await Promise.all([leerReferencias(tx, eventos), leerResumenMateriales(tx, id),
      can(actor, "cotizacion:ver") ? leerCostos(tx, id) : undefined]);
    return { cadena: aCadenaDto(orden, actor), eventos: eventos.map((evento) => aEventoDto({ evento, actor, referencias })),
      materiales: aMaterialesDto(materiales, costos), ...(costos ? { costoRealTotal: costos.total } : {}),
      responsables: responsablesTrabajo({ orden, eventos, referencias }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function opcionesBitacora(actor: Actor) {
  exigir(actor, "bitacora:ver");
  return consultarUsuarios(prisma);
}
export async function buscarOrdenPorNumero(numero: string, actor: Actor) {
  exigir(actor, "orden:ver");
  return buscarTrabajo(prisma, numero.trim());
}
