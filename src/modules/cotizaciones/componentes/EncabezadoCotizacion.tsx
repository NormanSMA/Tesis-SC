import { Fecha } from "@/components/comunes/ValorFormateado";
import { ListaDatos, TarjetaSeccion, type DatoFicha } from "@/components/comunes/TarjetaSeccion";
import { nombreMoneda } from "../moneda";
import type { CotizacionDto } from "../tipos";

/** Resumen de la ficha: moneda, vencimiento y resultado de la respuesta. Cliente, estado y versión van en la cabecera. */
export function EncabezadoCotizacion({ cotizacion }: { cotizacion: CotizacionDto }) {
  const datos: DatoFicha[] = [
    { etiqueta: "Moneda:", valor: nombreMoneda(cotizacion.moneda) },
    ...(cotizacion.moneda !== "NIO" ? [{ etiqueta: "Tipo de cambio:", valor: `C$ ${cotizacion.tipoCambio} por US$ 1` }] : []),
    { etiqueta: "Vencimiento", valor: <Fecha valor={cotizacion.fechaVencimiento} /> },
    ...(cotizacion.usuarioAprobacion ? [{ etiqueta: "Aprobación registrada por", valor: cotizacion.usuarioAprobacion.nombre }] : []),
    ...(cotizacion.referenciaAprobacion ? [{ etiqueta: "Referencia de aprobación", valor: cotizacion.referenciaAprobacion }] : []),
    ...(cotizacion.motivoRechazo ? [{ etiqueta: "Motivo del rechazo", valor: cotizacion.motivoRechazo, ancho: true }] : []),
    ...(cotizacion.motivoAjuste ? [{ etiqueta: "Motivo del ajuste", valor: cotizacion.motivoAjuste, ancho: true }] : []),
  ];
  return <div role="group" aria-label="Resumen de la cotización">
    <TarjetaSeccion titulo="Resumen"><ListaDatos datos={datos} className="lg:grid-cols-1" /></TarjetaSeccion>
  </div>;
}
