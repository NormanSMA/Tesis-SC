import { exigir, type Actor } from "@/core/autorizacion";
import { totalizarCotizacion } from "@/core/costeo";
import { type Moneda } from "@/core/moneda";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import { detalleCabecera, detalleItems } from "./auditoria";
import { costearItems } from "./costear";
import { aCotizacionDto, aCotizacionFila, aItemDto } from "./dto";
import { regla } from "./errores";
import { exigirBorrador, exigirCotizacion, guardarCabecera, guardarItems, registrarCambio, tomarVersion } from "./escritura";
import { aEntradaLinea } from "./mapeo";
import { configuracionCotizacion, consultarCotizaciones, siguienteNumero, type FichaGuardada } from "./repo";
import type { ConsultaCotizaciones, EntradaCrearCotizacion, EntradaEditarCotizacion, EntradaItem, EntradaReemplazarItems } from "./schema";
import type { CotizacionDto, ListaCotizaciones } from "./tipos";

export { leerIdCotizacion } from "./errores";
export { enviarCotizacion, responderCotizacion, archivarCotizacion } from "./estados";

async function exigirClienteActivo(tx: Tx, clienteId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM cliente WHERE id = ${clienteId}::uuid FOR SHARE`;
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente?.activo) throw regla("CLIENTE_ARCHIVADO", "Seleccione un cliente activo.");
}

type DatosNuevoBorrador = EntradaCrearCotizacion & { origen?: FichaGuardada; items?: EntradaItem[]; version?: number };

type ConfiguracionCotizacion = Awaited<ReturnType<typeof configuracionCotizacion>>;

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
  const totales = totalizarCotizacion({ items, descuento: entrada.origen?.descuento.toFixed(2) ?? "0", tasaImpuesto: configuracion.tasaImpuesto });
  const nuevo = await tx.cotizacion.create({ data: {
    numero: await siguienteNumero(tx), clienteId: entrada.clienteId, asunto: entrada.asunto,
    condiciones: entrada.condiciones === undefined ? configuracion.condiciones : entrada.condiciones,
    vigenciaDias: configuracion.vigenciaDias, creadoPorId: actor.id, cotizacionOrigenId: entrada.origen?.id,
    moneda, tipoCambio,
    version: entrada.version ?? 1, ...totales,
  } });
  await guardarItems(tx, nuevo.id, items);
  const ficha = await exigirCotizacion(tx, nuevo.id);
  await registrarCambio(tx, { ficha, actor, accion: "CREAR", estadoNuevo: "BORRADOR",
    detalle: { asunto: ficha.asunto, cotizacionOrigenId: ficha.cotizacionOrigenId, version: ficha.version, totales,
      items: ficha.items.map((item) => ({ secuencia: item.secuencia, descripcion: item.descripcion, importe: item.importe.toFixed(2) })) } });
  return ficha;
}

export async function crearCotizacion(entrada: EntradaCrearCotizacion, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => aCotizacionDto(await insertarBorrador(tx, entrada, actor)));
}

export async function editarCotizacion(id: string, entrada: EntradaEditarCotizacion, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => {
    const actual = await tomarVersion(tx, id, entrada.version);
    exigirBorrador(actual);
    const totales = totalizarCotizacion({ items: actual.items.map(aItemDto),
      descuento: entrada.descuento ?? actual.descuento.toFixed(2), tasaImpuesto: actual.tasaImpuesto.toFixed(2) });
    await guardarCabecera(tx, actual, { asunto: entrada.asunto, condiciones: entrada.condiciones,
      vigenciaDias: entrada.vigenciaDias, ...totales });
    const nueva = await exigirCotizacion(tx, id);
    await registrarCambio(tx, { ficha: nueva, actor, accion: "EDITAR", detalle: detalleCabecera(actual, nueva) });
    return aCotizacionDto(nueva);
  });
}

export async function reemplazarItems(id: string, entrada: EntradaReemplazarItems, actor: Actor): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => {
    const actual = await tomarVersion(tx, id, entrada.version);
    exigirBorrador(actual);
    const items = await costearItems(tx, { items: entrada.items, anteriores: actual.items, tipoCambio: actual.tipoCambio.toFixed(4) });
    const totales = totalizarCotizacion({ items, descuento: actual.descuento.toFixed(2), tasaImpuesto: actual.tasaImpuesto.toFixed(2) });
    await guardarItems(tx, id, items);
    await guardarCabecera(tx, actual, totales);
    const nueva = await exigirCotizacion(tx, id);
    await registrarCambio(tx, { ficha: nueva, actor, accion: "EDITAR", detalle: detalleItems(actual, nueva) });
    return aCotizacionDto(nueva);
  });
}

function entradaDeOrigen(item: FichaGuardada["items"][number]): EntradaItem {
  const dto = aItemDto(item);
  const base = { itemId: dto.id, cantidad: dto.cantidad, ancho: dto.ancho, alto: dto.alto };
  if (dto.tipo === "CATALOGO") return { ...base, tipo: "CATALOGO", productoId: dto.productoId! };
  return { ...base, tipo: "PERSONALIZADO", categoriaId: dto.categoriaId, descripcion: dto.descripcion,
    unidadCobro: dto.unidadCobro, margenPct: dto.margenPct!, lineas: dto.lineas.map(aEntradaLinea) };
}

async function duplicarBorrador(id: string, actor: Actor, corregida: boolean): Promise<CotizacionDto> {
  exigir(actor, "cotizacion:gestionar");
  return prisma.$transaction(async (tx) => {
    // El origen puede seguir en borrador: bloquear su cabecera evita copiar ítems durante otro reemplazo.
    await tx.$queryRaw`SELECT id FROM cotizacion WHERE id = ${id}::uuid FOR SHARE`;
    const origen = await exigirCotizacion(tx, id);
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

export async function obtenerCotizacion(id: string): Promise<CotizacionDto> {
  return aCotizacionDto(await exigirCotizacion(prisma, id));
}

export async function listarCotizaciones(consulta: ConsultaCotizaciones): Promise<ListaCotizaciones> {
  const { filas, total } = await consultarCotizaciones(consulta);
  return { datos: filas.map(aCotizacionFila), total, pagina: consulta.pagina, porPagina: consulta.porPagina };
}
