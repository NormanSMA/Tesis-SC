import { puedeVerCotizacion } from "@/modules/cotizaciones/acceso";
import { etapasVisibles, exigirParticipacion, soloEtapasPropias } from "@/modules/produccion/acceso";
import { can, type Actor } from "@/core/autorizacion";
import type { AdvertenciaEstimado } from "@/core/consumo-estimado";
import type { Cliente, Prisma } from "@/generated/prisma/client";
import { estaAtrasada } from "./reglas";
import type { FichaGuardada, FilaGuardada } from "./repo";
import type { ClienteOrden, EventoOrden, ItemOrden, LineaOrden, OrdenDto, OrdenFila } from "./tipos";

function clienteDto(cliente: Cliente, actor: Actor): ClienteOrden {
  const base = { id: cliente.id, nombre: cliente.nombre, codigoCliente: cliente.codigoCliente,
    tipo: cliente.tipo, telefono: cliente.telefono, correo: cliente.correo };
  return can(actor, "cliente:ver") ? { ...base, ruc: cliente.ruc, direccion: cliente.direccion } : base;
}

export function aOrdenFila(fila: FilaGuardada, actor: Actor): OrdenFila {
  const fechaEntrega = fila.fechaEntrega.toISOString().slice(0, 10);
  return { id: fila.id, numero: fila.numero, estado: fila.estado, categoria: fila.categoria, responsable: fila.responsable,
    cliente: clienteDto(fila.cliente, actor),
    ...(puedeVerCotizacion(actor, fila.cotizacion) ? {
      cotizacion: { id: fila.cotizacion.id, numero: fila.cotizacion.numero, asunto: fila.cotizacion.asunto },
    } : {}),
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

function itemDto(item: ItemGuardado, permisos: { verDinero: boolean; verConsumo: boolean }): ItemOrden {
  const { verDinero, verConsumo } = permisos;
  const base = { id: item.id, secuencia: item.secuencia, tipo: item.tipo, descripcion: item.descripcion, categoria: item.categoria,
    unidadCobro: item.unidadCobro, cantidad: item.cantidad.toFixed(3), ancho: item.ancho?.toFixed(3) ?? null,
    alto: item.alto?.toFixed(3) ?? null, profundidad: item.profundidad?.toFixed(3) ?? null,
    lineas: verConsumo ? item.lineasCosto.filter((linea) => verDinero || linea.tipo === "MATERIAL")
      .map((linea) => lineaDto(linea, verDinero)) : [] };
  return verDinero ? { ...base, precioUnitario: item.precioUnitario.toFixed(2), importe: item.importe.toFixed(2),
    costoTotal: item.costoTotal?.toFixed(2) ?? null, margenPct: item.margenPct?.toFixed(2) ?? null } : base;
}

function objetoJson(valor: Prisma.JsonValue): Prisma.JsonObject {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

function eventoDto(evento: FichaGuardada["eventosBitacora"][number], permisos: { verDinero: boolean; verConsumo: boolean }): EventoOrden {
  const { motivo, advertencias, ...detalle } = objetoJson(evento.detalle);
  const detalleVisible = permisos.verDinero
    ? { ...detalle, ...(typeof motivo === "string" && { motivo }), ...(permisos.verConsumo && advertencias !== undefined && { advertencias }) }
    : typeof motivo === "string" ? { motivo } : {};
  return { id: evento.id, entidad: evento.entidad, entidadId: evento.entidadId, accion: evento.accion,
    estadoAnterior: evento.estadoAnterior, estadoNuevo: evento.estadoNuevo, actor: evento.usuario.nombre,
    creadoEn: evento.creadoEn.toISOString(),
    detalle: detalleVisible };
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

function materialesOrden(ficha: FichaGuardada, advertencias: AdvertenciaEstimado[]) {
  const materialesTrabajo = new Map<string, OrdenDto["materialesTrabajo"][number]>();
  const materialesSinEstimacion: OrdenDto["materialesSinEstimacion"] = [];
  const idsEstimados = new Set(ficha.consumosEstimados.map(({ materialId }) => materialId));
  const lineasAdvertidas = new Set(advertencias.map(({ itemSecuencia, lineaSecuencia }) => `${itemSecuencia}:${lineaSecuencia}`));
  for (const { material, areaProduccion } of ficha.consumosEstimados) {
    materialesTrabajo.set(material.nombre.trim().toLocaleLowerCase("es"), { nombre: material.nombre, areaProduccion });
  }
  for (const item of ficha.cotizacion.items) {
    for (const linea of item.lineasCosto) {
      if (linea.tipo !== "MATERIAL") continue;
      const nombre = linea.material?.nombre ?? linea.descripcion;
      const clave = nombre.trim().toLocaleLowerCase("es");
      if (!materialesTrabajo.has(clave)) materialesTrabajo.set(clave, { nombre, areaProduccion: linea.material?.areaProduccion ?? null });
      if (!linea.materialId || !idsEstimados.has(linea.materialId) || lineasAdvertidas.has(`${item.secuencia}:${linea.secuencia}`)) {
        materialesSinEstimacion.push({ id: linea.id, nombre, cantidad: linea.cantidad.toFixed(3), unidad: linea.unidad });
      }
    }
  }
  return { materialesTrabajo: [...materialesTrabajo.values()], materialesSinEstimacion };
}

export function aOrdenDto(ficha: FichaGuardada, actor: Actor): OrdenDto {
  exigirParticipacion(actor, ficha);
  const verDinero = puedeVerCotizacion(actor, ficha.cotizacion);
  const verConsumo = can(actor, "inventario:ver");
  const permisos = { verDinero, verConsumo };
  const advertencias = verConsumo ? advertenciasGuardadas(ficha) : [];
  const { materialesTrabajo, materialesSinEstimacion } = materialesOrden(ficha, advertencias);
  const base = aOrdenFila(ficha, actor);
  const cotizacion = ficha.cotizacion;
  const etapas = etapasVisibles(ficha, actor);
  return { ...base, especificaciones: ficha.especificaciones, motivoCancelacion: ficha.motivoCancelacion,
    fechaInicioReal: ficha.fechaInicioReal?.toISOString() ?? null, fechaEntregaReal: ficha.fechaEntregaReal?.toISOString() ?? null,
    fechaCierre: ficha.fechaCierre?.toISOString() ?? null,
    ...(base.cotizacion ? { cotizacion: { ...base.cotizacion, moneda: cotizacion.moneda, tipoCambio: cotizacion.tipoCambio.toFixed(4), subtotal: cotizacion.subtotal.toFixed(2),
      descuento: cotizacion.descuento.toFixed(2), tasaImpuesto: cotizacion.tasaImpuesto.toFixed(2),
      impuesto: cotizacion.impuesto.toFixed(2), total: cotizacion.total.toFixed(2), margenPct: cotizacion.margenPct?.toFixed(2) ?? null } } : {}),
    items: cotizacion.items.map((item) => itemDto(item, permisos)), etapas: etapas.map(etapaDto),
    materialesTrabajo, materialesSinEstimacion: verConsumo ? materialesSinEstimacion : [],
    consumosEstimados: verConsumo ? ficha.consumosEstimados.map((consumo) => ({ id: consumo.id,
      material: { id: consumo.material.id, nombre: consumo.material.nombre, unidad: consumo.material.unidad },
      cantidad: consumo.cantidad.toFixed(3), origen: consumo.origen, areaProduccion: consumo.areaProduccion })) : [],
    // El personal de Producción no recibe la bitácora de la orden: la trazabilidad no le corresponde.
    eventos: soloEtapasPropias(actor) ? [] : ficha.eventosBitacora.filter(({ entidad }) =>
      (verConsumo || entidad !== "MOVIMIENTO_INVENTARIO") && (verDinero || entidad !== "COTIZACION"))
      .map((evento) => eventoDto(evento, permisos)), advertencias };
}

function etapaDto(etapa: FichaGuardada["etapas"][number]) {
  return { id: etapa.id, secuencia: etapa.secuencia, nombre: etapa.nombre, area: etapa.area, estado: etapa.estado,
    responsable: etapa.responsable, observaciones: etapa.observaciones, instrucciones: etapa.instrucciones,
    actualizadoEn: etapa.actualizadoEn.toISOString(),
    fechaInicioPlan: etapa.fechaInicioPlan?.toISOString().slice(0, 10) ?? null,
    fechaFinPlan: etapa.fechaFinPlan?.toISOString().slice(0, 10) ?? null,
    fechaInicioReal: etapa.fechaInicioReal?.toISOString() ?? null, fechaFinReal: etapa.fechaFinReal?.toISOString() ?? null };
}
