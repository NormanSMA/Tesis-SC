import { puedeVerCotizacion } from "@/modules/cotizaciones/acceso";
import { etapasVisibles, exigirParticipacion, soloEtapasPropias } from "@/modules/produccion/acceso";
import { can, exigir, type Actor } from "@/core/autorizacion";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { leerResumenMateriales } from "@/modules/inventario/resumen-orden";
import { noEncontrado } from "@/modules/ordenes/errores";
import { leerCostos } from "./costos";
import { aCadenaDto, aEventoDto, aMaterialesDto, responsablesTrabajo } from "./dto";
import { leerReferencias } from "./referencias";
import { buscarCadena, buscarTrabajo, consultarEventosOrden, consultarGlobal, consultarHistorialEtapas, consultarUsuarios } from "./repo";
import type { ConsultaBitacora } from "./schema";

export async function listarBitacora(consulta: ConsultaBitacora, actor: Actor) {
  exigir(actor, "bitacora:ver");
  return prisma.$transaction(async (tx) => {
    const { eventos, total } = await consultarGlobal(tx, { ...consulta, autorId: can(actor, "cotizacion:ver_todas") ? undefined : actor.id });
    const referencias = await leerReferencias(tx, eventos);
    return { datos: eventos.map((evento) => aEventoDto({ evento, actor, referencias })), total,
      pagina: consulta.pagina, porPagina: consulta.porPagina };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function obtenerTrazabilidad(id: string, actor: Actor) {
  exigir(actor, "orden:ver");
  const verConsumo = can(actor, "inventario:ver");

  return prisma.$transaction(async (tx) => {
    const orden = await buscarCadena(tx, id);
    if (!orden) throw noEncontrado();
    const verCotizacion = puedeVerCotizacion(actor, orden.cotizacion);
    const visible = verCotizacion ? actor : { ...actor, permisos: actor.permisos.filter(p => p !== "cotizacion:ver") };
    exigirParticipacion(actor, orden);
    orden.etapas = etapasVisibles(orden, actor);
    const idsEtapas = new Set(orden.etapas.map(e => e.id));
    const eventos = (await consultarEventosOrden(tx, orden)).filter(({ entidad, entidadId }) =>
      (!soloEtapasPropias(actor) || entidad !== "ETAPA_ORDEN" || idsEtapas.has(entidadId)) &&
      (verCotizacion || entidad !== "COTIZACION") && (verConsumo || entidad !== "MOVIMIENTO_INVENTARIO"));
    const [referencias, materiales, costos, historial] = await Promise.all([leerReferencias(tx, eventos),
      verConsumo ? leerResumenMateriales(tx, id) : [], verConsumo && verCotizacion ? leerCostos(tx, id) : undefined,
      consultarHistorialEtapas(tx, id)]);
    return { cadena: aCadenaDto(orden, visible, soloEtapasPropias(actor) ? historial.filter(h => idsEtapas.has(h.etapa.id)) : historial),
      eventos: eventos.map((evento) => aEventoDto({ evento, actor: visible, referencias })),
      verConsumo, materiales: aMaterialesDto(materiales, costos), ...(costos ? { costoRealTotal: costos.total } : {}),
      responsables: responsablesTrabajo({ orden, eventos, referencias }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function opcionesBitacora(actor: Actor) {
  exigir(actor, "bitacora:ver");
  return prisma.$transaction((tx) => consultarUsuarios(tx),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function buscarOrdenPorNumero(numero: string, actor: Actor) {
  exigir(actor, "orden:ver");
  return buscarTrabajo(prisma, numero.trim());
}
