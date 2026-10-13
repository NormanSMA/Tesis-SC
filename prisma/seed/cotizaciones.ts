import { randomUUID } from "node:crypto";

import type { Prisma } from "../../src/generated/prisma/client";
import { cotizacionPorEscenario, registrar } from "./bitacora";
import { margenResultante, totalesCotizacion } from "./calculos";
import { MONEDA, TASA_IVA_PCT } from "./catalogos";
import type { Escenario } from "./datos/esquemas";
import { fechaCalendario, instante, sumarDiasCalendario, type Reloj } from "./fechas";
import { calcularItems, type ItemCalculado } from "./items";
import { siguienteNumero } from "./numeracion";
import { usuarioPorClave, type Contexto } from "./tipos";

export type PlanCotizacion = {
  creadaEn: Date;
  enviadaEn: Date | null;
  respondidaEn: Date | null;
  fechaEmision: Date | null;
  fechaVencimiento: Date | null;
};

export type CotizacionSembrada = {
  id: string;
  numero: string;
  escenario: Escenario;
  items: ItemCalculado[];
  plan: PlanCotizacion;
};

const CONDICIONES =
  "Precios en córdobas (NIO). El IVA está incluido en el total. Anticipo del 50% para iniciar la producción. " +
  "La oferta vale hasta la fecha de vencimiento indicada.";
const MOTIVOS_RECHAZO = [
  "El cliente consideró el precio superior a su presupuesto.",
  "El cliente pospuso el proyecto para el próximo trimestre.",
  "El cliente eligió otro proveedor con entrega más corta.",
];
const MEDIOS_APROBACION = ["correo", "teléfono", "presencial"];

function exigirVigencia(escenario: Escenario): void {
  const { clave, diasAtras, vigenciaDias, estadoFinal } = escenario;
  const dentroDeVigencia = diasAtras <= vigenciaDias;
  if (estadoFinal === "VENCIDA" && dentroDeVigencia) {
    throw new Error(`${clave}: una cotización VENCIDA exige diasAtras mayor a la vigencia (${vigenciaDias})`);
  }
  // Una aprobada se respondió el día de la emisión, siempre dentro del plazo. Una enviada aún debe estar vigente.
  if (estadoFinal === "ENVIADA" && !dentroDeVigencia) {
    throw new Error(`${clave}: una cotización ENVIADA debe estar dentro de su vigencia`);
  }
}

// diasAtras fija la emisión. Rechazar o solicitar ajuste ocurre dos días después.
export function planificarCotizacion(reloj: Reloj, escenario: Escenario): PlanCotizacion {
  const { diasAtras, vigenciaDias, estadoFinal } = escenario;
  const creadaEn = instante(reloj, diasAtras, 8);
  if (estadoFinal === "BORRADOR") {
    return { creadaEn, enviadaEn: null, respondidaEn: null, fechaEmision: null, fechaVencimiento: null };
  }
  exigirVigencia(escenario);
  const fechaEmision = fechaCalendario(reloj, diasAtras);
  const respondidaEn = {
    ENVIADA: null,
    APROBADA: instante(reloj, diasAtras, 11),
    RECHAZADA: instante(reloj, diasAtras - 2, 15),
    AJUSTE_SOLICITADO: instante(reloj, diasAtras - 2, 15),
    VENCIDA: instante(reloj, diasAtras - vigenciaDias - 1, 8),
  }[estadoFinal];
  return {
    creadaEn,
    enviadaEn: instante(reloj, diasAtras, 9),
    respondidaEn,
    fechaEmision,
    fechaVencimiento: sumarDiasCalendario(fechaEmision, vigenciaDias),
  };
}

function filaItem(item: ItemCalculado, cotizacionId: string) {
  return {
    id: item.id,
    cotizacionId,
    secuencia: item.secuencia,
    tipo: item.tipo,
    productoId: item.productoId,
    categoriaId: item.categoriaId,
    descripcion: item.descripcion,
    unidadCobro: item.unidadCobro,
    cantidad: item.cantidad,
    ancho: item.ancho,
    alto: item.alto,
    precioUnitario: item.precioUnitario,
    costoTotal: item.costoTotal,
    margenPct: item.margenPct,
    importe: item.importe,
  };
}

async function insertarBorrador(ctx: Contexto, cotizacion: CotizacionSembrada): Promise<string> {
  const { db, catalogos } = ctx;
  const { id, numero, escenario, items, plan } = cotizacion;
  const totales = totalesCotizacion({ importes: items.map((i) => i.importe), descuento: 0, tasaPct: TASA_IVA_PCT });
  const personalizados = items.flatMap((i) =>
    i.costoTotal === null ? [] : [{ costoTotal: i.costoTotal, importe: i.importe }],
  );
  await db.cotizacion.create({
    data: {
      id,
      numero,
      clienteId: catalogos.clientes.get(escenario.cliente) as string,
      asunto: escenario.asunto,
      version: escenario.origen ? 2 : 1,
      cotizacionOrigenId: escenario.origen ? cotizacionPorEscenario(ctx.bitacora, escenario.origen) : null,
      condiciones: CONDICIONES,
      moneda: MONEDA,
      tipoCambio: "1",
      tasaImpuesto: TASA_IVA_PCT,
      ...totales,
      margenPct: margenResultante(personalizados),
      vigenciaDias: escenario.vigenciaDias,
      creadoPorId: usuarioPorClave(catalogos, "ventas").id,
      creadoEn: plan.creadaEn,
    },
  });
  await db.itemCotizacion.createMany({ data: items.map((item) => filaItem(item, id)) });
  await db.lineaCosto.createMany({
    data: items.flatMap((item) => item.lineas.map((linea) => ({ ...linea, itemId: item.id }))),
  });
  return totales.total;
}

type Cambio = {
  desde: string;
  hacia: "ENVIADA" | "APROBADA" | "RECHAZADA" | "VENCIDA" | "AJUSTE_SOLICITADO";
  cuando: Date;
  datos: Prisma.CotizacionUncheckedUpdateInput;
  detalle: Prisma.InputJsonObject;
};

function respuestaDeCotizacion(estado: string, respondidaEn: Date, indice: number): Cambio | null {
  const motivo = MOTIVOS_RECHAZO[indice % MOTIVOS_RECHAZO.length];
  const medio = MEDIOS_APROBACION[indice % MEDIOS_APROBACION.length];
  const base = { desde: "ENVIADA", cuando: respondidaEn };
  if (estado === "APROBADA") {
    return { ...base, hacia: "APROBADA", datos: { fechaRespuesta: respondidaEn }, detalle: { medio } };
  }
  if (estado === "RECHAZADA") {
    return {
      ...base,
      hacia: "RECHAZADA",
      datos: { fechaRespuesta: respondidaEn, motivoRechazo: motivo },
      detalle: { motivo },
    };
  }
  if (estado === "VENCIDA") {
    return { ...base, hacia: "VENCIDA", datos: {}, detalle: { causa: "Plazo de vigencia cumplido" } };
  }
  return null;
}

function cambiosDeCotizacion(cotizacion: CotizacionSembrada, indice: number): Cambio[] {
  const { escenario, plan } = cotizacion;
  if (escenario.estadoFinal === "BORRADOR") return [];
  const envio: Cambio = {
    desde: "BORRADOR",
    hacia: "ENVIADA",
    cuando: plan.enviadaEn as Date,
    datos: { fechaEmision: plan.fechaEmision, fechaVencimiento: plan.fechaVencimiento },
    detalle: { vigenciaDias: escenario.vigenciaDias },
  };
  const respuesta: Cambio | null = escenario.estadoFinal === "AJUSTE_SOLICITADO"
    ? {
        desde: "ENVIADA",
        hacia: "AJUSTE_SOLICITADO",
        cuando: plan.respondidaEn as Date,
        datos: { fechaRespuesta: plan.respondidaEn, motivoAjuste: escenario.motivoAjuste },
        detalle: { motivo: escenario.motivoAjuste as string },
      }
    : plan.respondidaEn ? respuestaDeCotizacion(escenario.estadoFinal, plan.respondidaEn, indice) : null;
  return respuesta ? [envio, respuesta] : [envio];
}

async function aplicarCambio(ctx: Contexto, cotizacion: CotizacionSembrada, cambio: Cambio): Promise<void> {
  // La aprobación la registra Operaciones con la referencia del medio en que el cliente la comunicó (RB-10).
  const aprobada = cambio.hacia === "APROBADA";
  const aprobacion: Prisma.CotizacionUncheckedUpdateInput = aprobada
    ? {
        usuarioAprobacionId: usuarioPorClave(ctx.catalogos, "operaciones").id,
        referenciaAprobacion: `Aceptación del cliente por ${String(cambio.detalle.medio ?? "medio no indicado")}`,
      }
    : {};
  await ctx.db.cotizacion.update({
    where: { id: cotizacion.id },
    data: { estado: cambio.hacia, ...cambio.datos, ...aprobacion },
  });
  registrar(ctx.bitacora, {
    entidad: "COTIZACION",
    entidadId: cotizacion.id,
    cotizacionId: cotizacion.id,
    accion: "CAMBIAR_ESTADO",
    estadoAnterior: cambio.desde,
    estadoNuevo: cambio.hacia,
    usuarioId: usuarioPorClave(ctx.catalogos, aprobada ? "operaciones" : "ventas").id,
    creadoEn: cambio.cuando,
    detalle: { numero: cotizacion.numero, ...cambio.detalle },
  });
}

// Crea la cotización en BORRADOR y la lleva por transiciones válidas hasta el estado del escenario.
export async function sembrarCotizacion(
  ctx: Contexto,
  { escenario, indice }: { escenario: Escenario; indice: number },
): Promise<CotizacionSembrada> {
  const plan = planificarCotizacion(ctx.reloj, escenario);
  const numero = await siguienteNumero(ctx.db, { tipo: "COTIZACION", momento: plan.creadaEn });
  const cotizacion: CotizacionSembrada = {
    id: randomUUID(),
    numero,
    escenario,
    items: calcularItems(escenario, ctx.catalogos),
    plan,
  };
  const total = await insertarBorrador(ctx, cotizacion);
  registrar(ctx.bitacora, {
    entidad: "COTIZACION",
    entidadId: cotizacion.id,
    cotizacionId: cotizacion.id,
    accion: "CREAR",
    estadoNuevo: "BORRADOR",
    usuarioId: usuarioPorClave(ctx.catalogos, "ventas").id,
    creadoEn: plan.creadaEn,
    detalle: {
      numero, cliente: escenario.cliente, total, clave: escenario.clave,
      ...(escenario.origen ? { origen: escenario.origen, version: 2 } : {}),
    },
  });
  for (const cambio of cambiosDeCotizacion(cotizacion, indice)) await aplicarCambio(ctx, cotizacion, cambio);
  return cotizacion;
}
