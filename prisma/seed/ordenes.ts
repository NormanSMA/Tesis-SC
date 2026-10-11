import { randomUUID } from "node:crypto";

import type { EstadoEtapa, Prisma } from "../../src/generated/prisma/client";
import { registrar } from "./bitacora";
import type { CotizacionSembrada } from "./cotizaciones";
import { calcularConsumoEstimado } from "./estimado";
import { desplazarMinutos } from "./fechas";
import { siguienteNumero } from "./numeracion";
import { planificarOrden, type EtapaPlan, type EstadoOrdenPlan, type PlanOrden } from "./plan-orden";
import { usuarioPorClave, type Contexto } from "./tipos";

export type OrdenSembrada = {
  id: string;
  numero: string;
  estado: EstadoOrdenPlan;
  cotizacion: CotizacionSembrada;
  plan: PlanOrden;
  responsableId: string;
};

type EtapaSembrada = EtapaPlan & { id: string };

const MOTIVO_CANCELACION = "El cliente canceló el pedido antes de iniciar la producción.";
const MOTIVO_OMISION_ORDEN_TERMINADA = "No se requiere en este trabajo.";

function nombreDeUsuario(ctx: Contexto, id: string): string {
  return [...ctx.catalogos.usuarios.values()].find((u) => u.id === id)?.nombre ?? id;
}

function especificaciones(cotizacion: CotizacionSembrada): string {
  const lineas = cotizacion.items.map((item) => {
    const medidas = item.ancho && item.alto ? ` (${Number(item.ancho)} x ${Number(item.alto)} m)` : "";
    return `- ${Number(item.cantidad)} x ${item.descripcion}${medidas}`;
  });
  const asunto = cotizacion.escenario.asunto ?? "Trabajo aprobado";
  return [`Cotización ${cotizacion.numero}: ${asunto}.`, ...lineas].join("\n");
}

async function crearOrden(ctx: Contexto, orden: OrdenSembrada): Promise<void> {
  const { db, catalogos } = ctx;
  const { cotizacion, plan } = orden;
  const operaciones = usuarioPorClave(catalogos, "operaciones").id;
  await db.ordenTrabajo.create({
    data: {
      id: orden.id,
      numero: orden.numero,
      cotizacionId: cotizacion.id,
      clienteId: catalogos.clientes.get(cotizacion.escenario.cliente) as string,
      categoriaId: plan.categoriaId,
      responsableId: orden.responsableId,
      especificaciones: especificaciones(cotizacion),
      fechaEntrega: plan.fechaEntrega,
      creadoPorId: operaciones,
      creadoEn: plan.creadaEn,
    },
  });
  registrar(ctx.bitacora, {
    entidad: "ORDEN_TRABAJO",
    entidadId: orden.id,
    ordenId: orden.id,
    cotizacionId: cotizacion.id,
    accion: "CONVERTIR_EN_ORDEN",
    estadoNuevo: "PENDIENTE",
    usuarioId: operaciones,
    creadoEn: plan.creadaEn,
    detalle: {
      numero: orden.numero,
      cotizacion: cotizacion.numero,
      categoria: plan.categoriaNombre,
      fechaEntrega: plan.fechaEntrega.toISOString().slice(0, 10),
    },
  });
  registrar(ctx.bitacora, {
    entidad: "ORDEN_TRABAJO",
    entidadId: orden.id,
    ordenId: orden.id,
    accion: "ASIGNAR_RESPONSABLE",
    usuarioId: operaciones,
    creadoEn: desplazarMinutos(ctx.reloj, plan.creadaEn, 1),
    detalle: { antes: null, despues: nombreDeUsuario(ctx, orden.responsableId) },
  });
}

async function crearConsumoEstimado(ctx: Contexto, orden: OrdenSembrada): Promise<void> {
  const estimados = calcularConsumoEstimado(orden.cotizacion, ctx.catalogos);
  await ctx.db.consumoEstimado.createMany({
    data: estimados.map((e) => ({ ...e, ordenId: orden.id, creadoEn: orden.plan.creadaEn })),
  });
}

// Las etapas nacen PENDIENTE y copian nombre y área de la plantilla de la categoría.
async function crearEtapas(ctx: Contexto, orden: OrdenSembrada): Promise<EtapaSembrada[]> {
  const jefe = usuarioPorClave(ctx.catalogos, "jefe-prod").id;
  const etapas = orden.plan.etapas.map((etapa) => ({ ...etapa, id: randomUUID() }));
  await ctx.db.etapaOrden.createMany({
    data: etapas.map((e) => ({
      id: e.id,
      ordenId: orden.id,
      plantillaId: e.plantilla.id,
      areaId: e.plantilla.areaId,
      secuencia: e.plantilla.secuencia,
      nombre: e.nombre,
      fechaInicioPlan: e.inicioPlan,
      fechaFinPlan: e.finPlan,
      creadoEn: orden.plan.creadaEn,
    })),
  });
  for (const e of etapas) {
    const creadoEn = desplazarMinutos(ctx.reloj, orden.plan.creadaEn, 2);
    await ctx.db.historialEtapa.create({ data: { ordenId: orden.id, etapaId: e.id, usuarioId: jefe,
      estadoAnterior: null, estadoNuevo: "PENDIENTE", responsableId: null, creadoEn } });
    registrar(ctx.bitacora, {
      entidad: "ETAPA_ORDEN",
      entidadId: e.id,
      ordenId: orden.id,
      accion: "CREAR",
      estadoNuevo: "PENDIENTE",
      usuarioId: jefe,
      creadoEn,
      detalle: { orden: orden.numero, etapa: e.nombre, secuencia: e.plantilla.secuencia },
    });
  }
  return etapas;
}

async function cambiarEstadoOrden(
  ctx: Contexto,
  orden: OrdenSembrada,
  cambio: {
    hacia: EstadoOrdenPlan;
    cuando: Date;
    actorId: string;
    datos?: Prisma.OrdenTrabajoUncheckedUpdateInput;
    detalle?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await ctx.db.ordenTrabajo.update({ where: { id: orden.id }, data: { estado: cambio.hacia, ...cambio.datos } });
  registrar(ctx.bitacora, {
    entidad: "ORDEN_TRABAJO",
    entidadId: orden.id,
    ordenId: orden.id,
    cotizacionId: orden.cotizacion.id,
    accion: "CAMBIAR_ESTADO",
    estadoAnterior: orden.estado,
    estadoNuevo: cambio.hacia,
    usuarioId: cambio.actorId,
    creadoEn: cambio.cuando,
    detalle: { numero: orden.numero, ...cambio.detalle },
  });
  orden.estado = cambio.hacia;
}

async function asignarResponsableDeEtapa(ctx: Contexto, orden: OrdenSembrada, etapa: EtapaSembrada): Promise<void> {
  const cuando = desplazarMinutos(ctx.reloj, etapa.inicioReal ?? orden.plan.creadaEn, -10);
  const usuarioId = usuarioPorClave(ctx.catalogos, "jefe-prod").id;
  await ctx.db.etapaOrden.update({ where: { id: etapa.id }, data: { responsableId: etapa.responsableId } });
  await ctx.db.historialEtapa.create({ data: { ordenId: orden.id, etapaId: etapa.id, usuarioId,
    estadoAnterior: "PENDIENTE", estadoNuevo: "PENDIENTE", responsableId: etapa.responsableId, creadoEn: cuando } });
  registrar(ctx.bitacora, {
    entidad: "ETAPA_ORDEN",
    entidadId: etapa.id,
    ordenId: orden.id,
    accion: "ASIGNAR_RESPONSABLE",
    usuarioId,
    creadoEn: cuando,
    detalle: { etapa: etapa.nombre, antes: null, despues: nombreDeUsuario(ctx, etapa.responsableId as string) },
  });
}

async function cambiarEstadoEtapa(
  ctx: Contexto,
  orden: OrdenSembrada,
  cambio: {
    etapa: EtapaSembrada;
    desde: EstadoEtapa;
    hacia: "EN_CURSO" | "COMPLETADA" | "OMITIDA";
    cuando: Date;
    datos: Prisma.EtapaOrdenUncheckedUpdateInput;
    detalle?: Prisma.InputJsonObject;
  },
): Promise<void> {
  const { etapa } = cambio;
  const usuarioId = etapa.responsableId ?? usuarioPorClave(ctx.catalogos, "jefe-prod").id;
  await ctx.db.etapaOrden.update({ where: { id: etapa.id }, data: { estado: cambio.hacia, ...cambio.datos } });
  await ctx.db.historialEtapa.create({ data: { ordenId: orden.id, etapaId: etapa.id, usuarioId,
    estadoAnterior: cambio.desde, estadoNuevo: cambio.hacia, responsableId: etapa.responsableId, creadoEn: cambio.cuando } });
  registrar(ctx.bitacora, {
    entidad: "ETAPA_ORDEN",
    entidadId: etapa.id,
    ordenId: orden.id,
    accion: "CAMBIAR_ESTADO",
    estadoAnterior: cambio.desde,
    estadoNuevo: cambio.hacia,
    usuarioId,
    creadoEn: cambio.cuando,
    detalle: { etapa: etapa.nombre, ...cambio.detalle },
  });
}

async function ejecutarEtapa(ctx: Contexto, orden: OrdenSembrada, etapa: EtapaSembrada): Promise<void> {
  if (!etapa.inicioReal) return;
  await asignarResponsableDeEtapa(ctx, orden, etapa);
  await cambiarEstadoEtapa(ctx, orden, {
    etapa,
    desde: "PENDIENTE",
    hacia: "EN_CURSO",
    cuando: etapa.inicioReal,
    datos: { fechaInicioReal: etapa.inicioReal },
  });
  if (orden.estado === "PENDIENTE") {
    await cambiarEstadoOrden(ctx, orden, {
      hacia: "EN_PRODUCCION",
      cuando: etapa.inicioReal,
      actorId: etapa.responsableId as string,
      datos: { fechaInicioReal: etapa.inicioReal },
    });
  }
  if (etapa.finReal) {
    await cambiarEstadoEtapa(ctx, orden, {
      etapa,
      desde: "EN_CURSO",
      hacia: "COMPLETADA",
      cuando: etapa.finReal,
      datos: { fechaFinReal: etapa.finReal },
    });
  }
}

async function omitirEtapas(ctx: Contexto, orden: OrdenSembrada, etapas: EtapaSembrada[]): Promise<void> {
  const motivo = orden.plan.canceladaEn ? MOTIVO_CANCELACION : MOTIVO_OMISION_ORDEN_TERMINADA;
  for (const etapa of etapas.filter((e) => e.estado === "OMITIDA")) {
    await cambiarEstadoEtapa(ctx, orden, {
      etapa: { ...etapa, responsableId: null },
      desde: "PENDIENTE",
      hacia: "OMITIDA",
      cuando: orden.plan.omitidaEn as Date,
      datos: { observaciones: motivo },
      detalle: { motivo },
    });
  }
}

// Lleva la orden por transiciones válidas hasta el estado del escenario. Las etapas se ejecutan antes.
async function cerrarCamino(ctx: Contexto, orden: OrdenSembrada, etapas: EtapaSembrada[]): Promise<void> {
  const { plan } = orden;
  const ventas = usuarioPorClave(ctx.catalogos, "ventas").id;
  const gerencia = usuarioPorClave(ctx.catalogos, "gerente").id;
  const objetivo = orden.cotizacion.escenario.orden?.estadoFinal;
  await omitirEtapas(ctx, orden, etapas);
  if (plan.canceladaEn) {
    await cambiarEstadoOrden(ctx, orden, {
      hacia: "CANCELADA",
      cuando: plan.canceladaEn,
      actorId: gerencia,
      datos: { motivoCancelacion: MOTIVO_CANCELACION },
      detalle: { motivo: MOTIVO_CANCELACION },
    });
    return;
  }
  const ultima = [...etapas].reverse().find((e) => e.finReal);
  if (plan.listaEn) {
    await cambiarEstadoOrden(ctx, orden, {
      hacia: "LISTA",
      cuando: plan.listaEn,
      actorId: ultima?.responsableId ?? orden.responsableId,
    });
  }
  if (plan.entregadaEn) {
    await cambiarEstadoOrden(ctx, orden, {
      hacia: "ENTREGADA",
      cuando: plan.entregadaEn,
      actorId: ventas,
      datos: { fechaEntregaReal: plan.entregadaEn },
    });
  }
  if (plan.cerradaEn) {
    await cambiarEstadoOrden(ctx, orden, {
      hacia: "CERRADA",
      cuando: plan.cerradaEn,
      actorId: gerencia,
      datos: { fechaCierre: plan.cerradaEn },
    });
  }
  if (orden.estado !== objetivo) {
    throw new Error(`${orden.cotizacion.escenario.clave}: la orden terminó en ${orden.estado} y se esperaba ${objetivo}`);
  }
}

export async function sembrarOrden(ctx: Contexto, cotizacion: CotizacionSembrada): Promise<OrdenSembrada> {
  const plan = planificarOrden(ctx.reloj, ctx.catalogos, cotizacion);
  const datosOrden = cotizacion.escenario.orden as NonNullable<typeof cotizacion.escenario.orden>;
  const orden: OrdenSembrada = {
    id: randomUUID(),
    numero: await siguienteNumero(ctx.db, { tipo: "ORDEN_TRABAJO", momento: plan.creadaEn }),
    estado: "PENDIENTE",
    cotizacion,
    plan,
    responsableId: usuarioPorClave(ctx.catalogos, datosOrden.responsable).id,
  };
  await crearOrden(ctx, orden);
  await crearConsumoEstimado(ctx, orden);
  const etapas = await crearEtapas(ctx, orden);
  for (const etapa of etapas) await ejecutarEtapa(ctx, orden, etapa);
  await cerrarCamino(ctx, orden, etapas);
  return orden;
}
