import { can, type Actor } from "@/core/autorizacion";
import type { AdvertenciaEstimado } from "@/core/consumo-estimado";
import type { Cliente, Prisma } from "@/generated/prisma/client";
import { estaAtrasada } from "./reglas";
import type { FichaGuardada, FilaGuardada } from "./repo";
import type { ClienteOrden, EventoOrden, ItemOrden, LineaOrden, OrdenDto, OrdenFila } from "./tipos";

function clienteDto(cliente: Cliente, actor: Actor): ClienteOrden {
  const base = { id: cliente.id, nombre: cliente.nombre, tipo: cliente.tipo, telefono: cliente.telefono, correo: cliente.correo };
  return can(actor, "cliente:ver") ? { ...base, ruc: cliente.ruc, direccion: cliente.direccion } : base;
}

export function aOrdenFila(fila: FilaGuardada, actor: Actor): OrdenFila {
  const fechaEntrega = fila.fechaEntrega.toISOString().slice(0, 10);
  return { id: fila.id, numero: fila.numero, estado: fila.estado, categoria: fila.categoria, responsable: fila.responsable,
    cliente: clienteDto(fila.cliente, actor),
    cotizacion: { id: fila.cotizacion.id, numero: fila.cotizacion.numero, asunto: fila.cotizacion.asunto },
    fechaEntrega, atrasada: estaAtrasada({ estado: fila.estado, fechaEntrega }),
    actualizadoEn: fila.actualizadoEn.toISOString(), creadoEn: fila.creadoEn.toISOString() };
}

type ItemGuardado = FichaGuardada["cotizacion"]["items"][number];
function lineaDto(linea: ItemGuardado["lineasCosto"][number], verDinero: boolean): LineaOrden {
  const base = { id: linea.id, secuencia: linea.secuencia, tipo: linea.tipo, descripcion: linea.descripcion,
    unidad: linea.unidad, cantidad: linea.cantidad.toFixed(3), mermaPct: linea.mermaPct.toFixed(2),
    material: linea.material ? { id: linea.material.id, nombre: linea.material.nombre, unidad: linea.material.unidad } : null };
  return verDinero ? { ...base, costoUnitario: linea.costoUnitario.toFixed(4), importe: linea.importe.toFixed(2) } : base;
}

function itemDto(item: ItemGuardado, verDinero: boolean): ItemOrden {
  const base = { id: item.id, secuencia: item.secuencia, tipo: item.tipo, descripcion: item.descripcion, categoria: item.categoria,
    unidadCobro: item.unidadCobro, cantidad: item.cantidad.toFixed(3), ancho: item.ancho?.toFixed(3) ?? null,
    alto: item.alto?.toFixed(3) ?? null, lineas: item.lineasCosto.map((linea) => lineaDto(linea, verDinero)) };
  return verDinero ? { ...base, precioUnitario: item.precioUnitario.toFixed(2), importe: item.importe.toFixed(2),
    costoTotal: item.costoTotal?.toFixed(2) ?? null, margenPct: item.margenPct?.toFixed(2) ?? null } : base;
}

function objetoJson(valor: Prisma.JsonValue): Prisma.JsonObject {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

function eventoDto(evento: FichaGuardada["eventosBitacora"][number], verDinero: boolean): EventoOrden {
  const motivo = objetoJson(evento.detalle).motivo;
  return { id: evento.id, entidad: evento.entidad, entidadId: evento.entidadId, accion: evento.accion,
    estadoAnterior: evento.estadoAnterior, estadoNuevo: evento.estadoNuevo, actor: evento.usuario.nombre,
    creadoEn: evento.creadoEn.toISOString(),
    detalle: verDinero ? evento.detalle : typeof motivo === "string" ? { motivo } : {} };
}

function advertenciasGuardadas(ficha: FichaGuardada): AdvertenciaEstimado[] {
  const conversion = ficha.eventosBitacora.find((evento) => evento.accion === "CONVERTIR_EN_ORDEN");
  const advertencias = conversion && objetoJson(conversion.detalle).advertencias;
  if (!Array.isArray(advertencias)) return [];
  return advertencias.flatMap((valor) => {
    const fila = objetoJson(valor);
    return typeof fila.itemSecuencia === "number" && typeof fila.lineaSecuencia === "number" && typeof fila.mensaje === "string"
      ? [{ itemSecuencia: fila.itemSecuencia, lineaSecuencia: fila.lineaSecuencia, mensaje: fila.mensaje }] : [];
  });
}

export function aOrdenDto(ficha: FichaGuardada, actor: Actor): OrdenDto {
  const verDinero = can(actor, "cotizacion:ver");
  const base = aOrdenFila(ficha, actor);
  const cotizacion = ficha.cotizacion;
  return { ...base, especificaciones: ficha.especificaciones, motivoCancelacion: ficha.motivoCancelacion,
    fechaInicioReal: ficha.fechaInicioReal?.toISOString() ?? null, fechaEntregaReal: ficha.fechaEntregaReal?.toISOString() ?? null,
    fechaCierre: ficha.fechaCierre?.toISOString() ?? null,
    cotizacion: verDinero ? { ...base.cotizacion, moneda: cotizacion.moneda, subtotal: cotizacion.subtotal.toFixed(2),
      descuento: cotizacion.descuento.toFixed(2), tasaImpuesto: cotizacion.tasaImpuesto.toFixed(2),
      impuesto: cotizacion.impuesto.toFixed(2), total: cotizacion.total.toFixed(2), margenPct: cotizacion.margenPct?.toFixed(2) ?? null } : base.cotizacion,
    items: cotizacion.items.map((item) => itemDto(item, verDinero)), etapas: ficha.etapas.map(etapaDto),
    consumosEstimados: ficha.consumosEstimados.map((consumo) => ({ id: consumo.id,
      material: { id: consumo.material.id, nombre: consumo.material.nombre, unidad: consumo.material.unidad },
      cantidad: consumo.cantidad.toFixed(3), origen: consumo.origen })),
    eventos: ficha.eventosBitacora.map((evento) => eventoDto(evento, verDinero)), advertencias: advertenciasGuardadas(ficha) };
}

function etapaDto(etapa: FichaGuardada["etapas"][number]) {
  return { id: etapa.id, secuencia: etapa.secuencia, nombre: etapa.nombre, area: etapa.area, estado: etapa.estado,
    responsable: etapa.responsable, observaciones: etapa.observaciones, actualizadoEn: etapa.actualizadoEn.toISOString(),
    fechaInicioPlan: etapa.fechaInicioPlan?.toISOString().slice(0, 10) ?? null,
    fechaFinPlan: etapa.fechaFinPlan?.toISOString().slice(0, 10) ?? null,
    fechaInicioReal: etapa.fechaInicioReal?.toISOString() ?? null, fechaFinReal: etapa.fechaFinReal?.toISOString() ?? null };
}
