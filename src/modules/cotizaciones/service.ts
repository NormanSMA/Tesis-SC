import { exigirAccesoCotizacion, filtroAutor } from "./acceso";
import { exigir, type Actor } from "@/core/autorizacion";
import { type Moneda } from "@/core/moneda";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { detalleCabecera, detalleItems } from "./auditoria";
import { totalizarConDescuento } from "./calculo";
import { costearItems } from "./costear";
import { aCotizacionDto, aCotizacionFila, aItemDto } from "./dto";
import { regla } from "./errores";
import { exigirBorrador, exigirCotizacion, guardarCabecera, guardarItems, registrarCambio, tomarVersion } from "./escritura";
import { hoyManagua } from "./fechas";
import { conInstalacion, datosInstalacion } from "./instalacion";
import { aEntradaLinea } from "./mapeo";
import { configuracionCotizacion, consultarConteosCotizaciones, consultarCotizaciones, siguienteNumero, type FichaGuardada } from "./repo";
import type { ConsultaCotizaciones, EntradaCrearCotizacion, EntradaEditarCotizacion, EntradaItem, EntradaReemplazarItems } from "./schema";
import type { ConteosCotizaciones, CotizacionDto, ListaCotizaciones } from "./tipos";

export { leerIdCotizacion } from "./errores";
export { enviarCotizacion, responderCotizacion, archivarCotizacion } from "./estados";

async function exigirClienteActivo(tx: Tx, clienteId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM cliente WHERE id = ${clienteId}::uuid FOR SHARE`;
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente?.activo) throw regla("CLIENTE_ARCHIVADO", "Seleccione un cliente activo.");
}

type DatosNuevoBorrador = EntradaCrearCotizacion & { origen?: FichaGuardada; items?: EntradaItem[]; version?: number };

type ConfiguracionCotizacion = Awaited<ReturnType<typeof configuracionCotizacion>>;

function descuentoParaBorrador(entrada: DatosNuevoBorrador, configuracion: ConfiguracionCotizacion) {
  const origen = entrada.origen;
  const tarifa = entrada.tarifa ?? (origen?.tarifa as keyof ConfiguracionCotizacion["tarifas"] | undefined) ?? "OCASIONAL";
  const tarifaPct = origen?.tarifaPct?.toFixed(2) ?? configuracion.tarifas[tarifa];
  const descuentoManual = origen ? esDescuentoManual(origen) :
    entrada.descuentoManual ?? (entrada.descuento !== undefined || entrada.descuentoPct != null);
  const descuentoPct = descuentoManual ? entrada.descuentoPct ?? origen?.descuentoPct?.toFixed(2) ?? null
    : Number(tarifaPct) > 0 ? tarifaPct : null;
  return { tarifa, tarifaPct, descuentoManual, descuentoPct };
}

function esDescuentoManual(ficha: FichaGuardada): boolean {
  return ficha.descuentoManual || (ficha.tarifaPct === null && (ficha.descuentoPct !== null || !ficha.descuento.isZero()));
}

/** La moneda y el tipo de cambio se fijan al crear. Duplicar y corregir copian los del origen. */
function monedaYTipoCambio(entrada: DatosNuevoBorrador, configuracion: ConfiguracionCotizacion): { moneda: Moneda; tipoCambio: string } {
  if (entrada.origen) return { moneda: entrada.origen.moneda as Moneda, tipoCambio: entrada.origen.tipoCambio.toFixed(4) };
  const moneda = entrada.moneda ?? configuracion.moneda;
  if (moneda === "NIO") return { moneda, tipoCambio: "1" };
  if (!configuracion.tipoCambioUsd) {
    throw new AppError({ codigo: "CONFIGURACION_INVALIDA", status: 409,
      mensaje: "Revise el tipo de cambio USD en la configuración." });
  }
  return { moneda, tipoCambio: configuracion.tipoCambioUsd };
}

async function insertarBorrador(tx: Tx, entrada: DatosNuevoBorrador, actor: Actor): Promise<FichaGuardada> {
  await exigirClienteActivo(tx, entrada.clienteId);
  const configuracion = await configuracionCotizacion(tx);
  const { moneda, tipoCambio } = monedaYTipoCambio(entrada, configuracion);
  const items = await costearItems(tx, { items: entrada.items ?? [], anteriores: entrada.origen?.items ?? [], tipoCambio, duplicando: true });
  const comercial = descuentoParaBorrador(entrada, configuracion);
  const instalacion = datosInstalacion(entrada.instalacion, { actual: entrada.origen, tipoCambio, tarifaNio: configuracion.tarifaInstalacion });
  const totales = conInstalacion(totalizarConDescuento({ items,
    descuento: comercial.descuentoManual ? entrada.descuento ?? entrada.origen?.descuento.toFixed(2) ?? "0" : "0",
    descuentoPct: comercial.descuentoPct, tasaImpuesto: "0" }), instalacion.instalacionTotal);
  const nuevo = await tx.cotizacion.create({ data: {
    numero: await siguienteNumero(tx), clienteId: entrada.clienteId, asunto: entrada.asunto,
    condiciones: entrada.condiciones === undefined ? configuracion.condiciones : entrada.condiciones,
    mostrarCondiciones: entrada.mostrarCondiciones ?? entrada.origen?.mostrarCondiciones ?? true,
    vigenciaDias: configuracion.vigenciaDias, creadoPorId: actor.id, cotizacionOrigenId: entrada.origen?.id,
    moneda, tipoCambio, ...comercial, ...instalacion,
    version: entrada.version ?? 1, ...totales,
  } });
  await guardarItems(tx, nuevo.id, items);
  const ficha = await exigirCotizacion(tx, nuevo.id);
  await registrarCambio(tx, { ficha, actor, accion: "CREAR", estadoNuevo: "BORRADOR",
    detalle: { asunto: ficha.asunto, cotizacionOrigenId: ficha.cotizacionOrigenId, version: ficha.version, totales,
      ...comercial, ...instalacion, mostrarCondiciones: ficha.mostrarCondiciones,
      items: ficha.items.map((item) => ({ secuencia: item.secuencia, descripcion: item.descripcion, importe: item.importe.toFixed(2) })) } });
  return ficha;
}

export async function crearCotizacion(entrada: EntradaCrearCotizacion, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => aCotizacionDto(await insertarBorrador(tx, entrada, actor)));
}

async function descuentoEditado(tx: Tx, actual: FichaGuardada, entrada: EntradaEditarCotizacion) {
  const tarifa = entrada.tarifa ?? actual.tarifa as keyof ConfiguracionCotizacion["tarifas"];
  const cambiaTarifa = tarifa !== actual.tarifa;
  const tarifaPct = cambiaTarifa ? (await configuracionCotizacion(tx)).tarifas[tarifa] :
    actual.tarifaPct?.toFixed(2) ?? "0";
  const nuevoManual = entrada.descuento !== undefined || entrada.descuentoPct !== undefined;
  const descuentoManual = entrada.descuentoManual ?? (nuevoManual || esDescuentoManual(actual));
  const descuentoPct = descuentoManual
    ? entrada.descuentoPct !== undefined ? entrada.descuentoPct
      : entrada.descuento !== undefined ? null : actual.descuentoPct?.toFixed(2) ?? null
    : Number(tarifaPct) > 0 ? tarifaPct : null;
  return { tarifa, tarifaPct, descuentoManual, descuentoPct };
}

export async function editarCotizacion(id: string, entrada: EntradaEditarCotizacion, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => {
    const actual = await tomarVersion(tx, id, entrada.version);
    exigirAccesoCotizacion(actor, actual);
    exigirBorrador(actual);
    const comercial = await descuentoEditado(tx, actual, entrada);
    const tarifaNio = entrada.instalacion?.km && actual.instalacionTarifa === null
      ? (await configuracionCotizacion(tx)).tarifaInstalacion : "0";
    const instalacion = datosInstalacion(entrada.instalacion, { actual, tipoCambio: actual.tipoCambio.toFixed(4), tarifaNio });
    const totales = conInstalacion(totalizarConDescuento({ items: actual.items.map(aItemDto), descuentoPct: comercial.descuentoPct,
      descuento: comercial.descuentoManual ? entrada.descuento ?? actual.descuento.toFixed(2) : "0", tasaImpuesto: "0" }), instalacion.instalacionTotal);
    await guardarCabecera(tx, actual, { asunto: entrada.asunto, condiciones: entrada.condiciones,
      mostrarCondiciones: entrada.mostrarCondiciones, vigenciaDias: entrada.vigenciaDias, ...comercial, ...instalacion, ...totales });
    const nueva = await exigirCotizacion(tx, id);
    await registrarCambio(tx, { ficha: nueva, actor, accion: "EDITAR", detalle: detalleCabecera(actual, nueva) });
    return aCotizacionDto(nueva);
  });
}

export async function reemplazarItems(id: string, entrada: EntradaReemplazarItems, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => {
    const actual = await tomarVersion(tx, id, entrada.version);
    exigirAccesoCotizacion(actor, actual);
    exigirBorrador(actual);
    const items = await costearItems(tx, { items: entrada.items, anteriores: actual.items, tipoCambio: actual.tipoCambio.toFixed(4) });
    const totales = conInstalacion(totalizarConDescuento({ items, descuento: actual.descuento.toFixed(2),
      descuentoPct: actual.descuentoPct?.toFixed(2) ?? null, tasaImpuesto: "0" }), actual.instalacionTotal.toFixed(2));
    await guardarItems(tx, id, items);
    await guardarCabecera(tx, actual, totales);
    const nueva = await exigirCotizacion(tx, id);
    await registrarCambio(tx, { ficha: nueva, actor, accion: "EDITAR", detalle: detalleItems(actual, nueva) });
    return aCotizacionDto(nueva);
  });
}

function entradaDeOrigen(item: FichaGuardada["items"][number]): EntradaItem {
  const dto = aItemDto(item);
  const base = { itemId: dto.id, cantidad: dto.cantidad, ancho: dto.ancho, alto: dto.alto, profundidad: dto.profundidad };
  if (dto.tipo === "CATALOGO") return { ...base, tipo: "CATALOGO", productoId: dto.productoId! };
  return { ...base, tipo: "PERSONALIZADO", categoriaId: dto.categoriaId, descripcion: dto.descripcion,
    unidadCobro: dto.unidadCobro, margenPct: dto.margenPct!, ...(dto.productoPersonalizado ? { productoPersonalizado: dto.productoPersonalizado } : {}), ...(dto.gastosPersonalizados ? { gastosPersonalizados: dto.gastosPersonalizados } : {}), lineas: dto.lineas.map(aEntradaLinea) };
}

async function duplicarBorrador(id: string, actor: Actor, corregida: boolean): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => {
    // El origen puede seguir en borrador: bloquear su cabecera evita copiar ítems durante otro reemplazo.
    await tx.$queryRaw`SELECT id FROM cotizacion WHERE id = ${id}::uuid FOR SHARE`;
    const origen = await exigirCotizacion(tx, id);
    exigirAccesoCotizacion(actor, origen);
    if (corregida && origen.estado !== "AJUSTE_SOLICITADO") {
      throw regla("TRANSICION_INVALIDA", "Solo se puede corregir una cotización con ajustes solicitados.");
    }
    if (corregida && origen.archivada) throw regla("COTIZACION_ARCHIVADA", "La cotización está archivada.");
    return aCotizacionDto(await insertarBorrador(tx, { clienteId: origen.clienteId,
      asunto: origen.asunto ?? "Cotización duplicada", condiciones: origen.condiciones,
      origen, version: corregida ? origen.version + 1 : 1, items: origen.items.map(entradaDeOrigen) }, actor));
  });
}

export function duplicarCotizacion(id: string, actor: Actor): Promise<CotizacionDto> {
  return duplicarBorrador(id, actor, false);
}

export function crearVersionCorregida(id: string, actor: Actor): Promise<CotizacionDto> {
  return duplicarBorrador(id, actor, true);
}

export async function obtenerCotizacion(id: string, actor?: Actor): Promise<CotizacionDto> {
  const ficha = await exigirCotizacion(prisma, id);
  if (actor) exigirAccesoCotizacion(actor, ficha);
  return aCotizacionDto(ficha);
}

function totalLista(consulta: ConsultaCotizaciones, conteos: ConteosCotizaciones): number {
  if (consulta.porVencer) {
    if (consulta.estado && consulta.estado !== "ENVIADA") return 0;
    return conteos.porVencer;
  }
  return consulta.estado ? conteos[consulta.estado] : conteos.todas;
}

export async function listarCotizaciones(consulta: ConsultaCotizaciones, actor?: Actor): Promise<ListaCotizaciones> {
  if (actor) consulta = { ...consulta, autorId: filtroAutor(actor).creadoPorId };
  const hoy = hoyManagua();
  const [filas, conteos] = await Promise.all([
    consultarCotizaciones(consulta, hoy), consultarConteosCotizaciones(consulta, hoy),
  ]);
  const total = totalLista(consulta, conteos);
  return { datos: filas.map(aCotizacionFila), total, pagina: consulta.pagina, porPagina: consulta.porPagina, conteos };
}
