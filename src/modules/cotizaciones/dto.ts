import { esquemaSeleccionProducto } from "@/modules/personalizadas/seleccion-schema";
import { esquemaGastos } from "@/modules/personalizadas/gastos-schema";
import type { Cliente, Cotizacion, Prisma } from "@/generated/prisma/client";
import type { FichaGuardada, ItemGuardado } from "./repo";
import type { CotizacionDto, CotizacionFila, ItemDto, LineaDto } from "./tipos";
import type { Tarifa } from "./tarifas";

export function aClienteDto(cliente: Cliente) {
  return { id: cliente.id, nombre: cliente.nombre, ruc: cliente.ruc,
    contactoPrincipal: cliente.contactoPrincipal, telefono: cliente.telefono, correo: cliente.correo,
    direccion: cliente.direccion, activo: cliente.activo };
}

export function aTotalesDto(cotizacion: Cotizacion) {
  return { subtotal: cotizacion.subtotal.toFixed(2), descuento: cotizacion.descuento.toFixed(2),
    tasaImpuesto: cotizacion.tasaImpuesto.toFixed(2), impuesto: cotizacion.impuesto.toFixed(2),
    total: cotizacion.total.toFixed(2), margenPct: cotizacion.margenPct?.toFixed(2) ?? null };
}

export function aInstalacionDto(fila: Cotizacion) {
  return { ...(fila.instalacionIdaVuelta ? { idaVuelta: true } : {}), destino: fila.instalacionDestino, km: fila.instalacionKm?.toFixed(3) ?? null,
    tarifa: fila.instalacionTarifa?.toFixed(2) ?? null, manoObra: fila.instalacionManoObra.toFixed(2), total: fila.instalacionTotal.toFixed(2) };
}

export function aCotizacionFila(fila: Cotizacion & {
  cliente: Cliente; usuarioAprobacion: { id: string; nombre: string } | null;
}): CotizacionFila {
  return { ...aTotalesDto(fila), descuentoPct: fila.descuentoPct?.toFixed(2) ?? null, id: fila.id, numero: fila.numero, clienteId: fila.clienteId,
    cliente: aClienteDto(fila.cliente), estado: fila.estado, asunto: fila.asunto, condiciones: fila.condiciones,
    mostrarCondiciones: fila.mostrarCondiciones, tarifa: fila.tarifa as Tarifa, tarifaPct: fila.tarifaPct?.toFixed(2) ?? null,
    instalacion: aInstalacionDto(fila),
    descuentoManual: fila.descuentoManual || (fila.tarifaPct === null && (fila.descuentoPct !== null || !fila.descuento.isZero())),
    cotizacionOrigenId: fila.cotizacionOrigenId, moneda: fila.moneda, tipoCambio: fila.tipoCambio.toFixed(4), vigenciaDias: fila.vigenciaDias,
    fechaEmision: fila.fechaEmision?.toISOString().slice(0, 10) ?? null,
    fechaVencimiento: fila.fechaVencimiento?.toISOString().slice(0, 10) ?? null,
    fechaRespuesta: fila.fechaRespuesta?.toISOString() ?? null, motivoRechazo: fila.motivoRechazo,
    version: fila.version, motivoAjuste: fila.motivoAjuste, referenciaAprobacion: fila.referenciaAprobacion,
    usuarioAprobacionId: fila.usuarioAprobacionId, usuarioAprobacion: fila.usuarioAprobacion,
    archivada: fila.archivada, creadoEn: fila.creadoEn.toISOString(), actualizadoEn: fila.actualizadoEn.toISOString() };
}

type LineaGuardada = Prisma.LineaCostoGetPayload<object>;
export function aLineaDto(linea: LineaGuardada): LineaDto {
  return { ...(linea.esGastoPersonalizado ? { esGastoPersonalizado: true } : {}), id: linea.id, secuencia: linea.secuencia, tipo: linea.tipo, descripcion: linea.descripcion,
    materialId: linea.materialId, unidad: linea.unidad, cantidad: linea.cantidad.toFixed(3),
    cantidadPorArea: linea.cantidadPorArea, areaUnidadInventario: linea.areaUnidadInventario?.toFixed(6) ?? null,
    costoUnitario: linea.costoUnitario.toFixed(4), mermaPct: linea.mermaPct.toFixed(2), importe: linea.importe.toFixed(2) };
}

export function aItemDto(item: ItemGuardado): ItemDto {
  return { ...(item.productoPersonalizado ? { productoPersonalizado: esquemaSeleccionProducto.parse(item.productoPersonalizado) } : {}), ...(item.gastosPersonalizados ? { gastosPersonalizados: esquemaGastos.parse(item.gastosPersonalizados) } : {}), id: item.id, secuencia: item.secuencia, tipo: item.tipo, productoId: item.productoId,
    categoriaId: item.categoriaId, descripcion: item.descripcion, unidadCobro: item.unidadCobro,
    cantidad: item.cantidad.toFixed(3), ancho: item.ancho?.toFixed(3) ?? null, alto: item.alto?.toFixed(3) ?? null,
    profundidad: item.profundidad?.toFixed(3) ?? null,
    precioUnitario: item.precioUnitario.toFixed(2), costoTotal: item.costoTotal?.toFixed(2) ?? null,
    margenPct: item.margenPct?.toFixed(2) ?? null, importe: item.importe.toFixed(2),
    lineas: item.lineasCosto.map(aLineaDto), productoActivo: item.producto?.activo ?? null };
}

export function aCotizacionDto(fila: FichaGuardada): CotizacionDto {
  const items = fila.items.map(aItemDto);
  const avisos = items.filter((item) => item.productoActivo === false)
    .map((item) => `El producto de «${item.descripcion}» está archivado. Se conserva su precio guardado.`);
  return { ...aCotizacionFila(fila), items, avisos };
}
