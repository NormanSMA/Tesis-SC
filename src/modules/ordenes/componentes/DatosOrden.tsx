import Link from "next/link";
import { Fecha, Money } from "@/components/comunes/ValorFormateado";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { monedaDe } from "@/modules/cotizaciones/moneda";
import type { OrdenDto } from "../tipos";

export function DatosCliente({ orden, verCliente, verCotizacion }: { orden: OrdenDto; verCliente: boolean; verCotizacion: boolean }) {
  const moneda = monedaDe(orden.cotizacion.moneda);
  const enlace = (href: string, texto: string) => <Link href={href} className="text-primary underline">{texto}</Link>;
  return <TarjetaSeccion titulo="Cliente y cotización" className="min-w-0">
    <div className="space-y-5">
      <ListaDatos datos={[
        { etiqueta: "Cliente", valor: verCliente ? enlace(`/clientes/${orden.cliente.id}`, orden.cliente.nombre) : orden.cliente.nombre },
        { etiqueta: "Tipo", valor: orden.cliente.tipo === "EMPRESA" ? "Empresa" : "Persona" },
        { etiqueta: "Teléfono", valor: orden.cliente.telefono || null }, { etiqueta: "Correo", valor: orden.cliente.correo || null },
        ...(verCliente ? [{ etiqueta: "RUC", valor: orden.cliente.ruc || null }, { etiqueta: "Dirección", valor: orden.cliente.direccion || null }] : []),
        { etiqueta: "Cotización", valor: verCotizacion ? enlace(`/cotizaciones/${orden.cotizacion.id}`, orden.cotizacion.numero) : orden.cotizacion.numero },
        { etiqueta: "Asunto", valor: orden.cotizacion.asunto || null },
      ]} />
      {orden.cotizacion.total !== undefined ? <ListaDatos className="border-t border-slate-100 pt-5" datos={[
        { etiqueta: "Subtotal", valor: <Money valor={orden.cotizacion.subtotal} moneda={moneda} /> },
        { etiqueta: "Descuento", valor: <Money valor={orden.cotizacion.descuento} moneda={moneda} /> },
        { etiqueta: `IVA (${orden.cotizacion.tasaImpuesto} %)`, valor: <Money valor={orden.cotizacion.impuesto} moneda={moneda} /> },
        { etiqueta: "Total", valor: <Money valor={orden.cotizacion.total} moneda={moneda} /> },
      ]} /> : null}
    </div>
  </TarjetaSeccion>;
}

export function DatosOrden({ orden }: { orden: OrdenDto }) {
  return <TarjetaSeccion titulo="Datos de la orden" className="min-w-0">
    <div className="space-y-5">
      <ListaDatos datos={[
        { etiqueta: "Inicio real", valor: orden.fechaInicioReal ? <Fecha valor={orden.fechaInicioReal} /> : null },
        { etiqueta: "Entrega real", valor: orden.fechaEntregaReal ? <Fecha valor={orden.fechaEntregaReal} /> : null },
        { etiqueta: "Cierre", valor: orden.fechaCierre ? <Fecha valor={orden.fechaCierre} /> : null },
        { etiqueta: "Creación", valor: <Fecha valor={orden.creadoEn} /> },
      ]} />
      <div><h3 className="text-xs font-medium text-slate-500">Especificaciones</h3>
        <p className="mt-1 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {orden.especificaciones || "Sin especificaciones."}</p></div>
      {orden.motivoCancelacion ? <div><h3 className="text-xs font-medium text-slate-500">Motivo de cancelación</h3>
        <p className="mt-1 text-sm break-words [overflow-wrap:anywhere]">{orden.motivoCancelacion}</p></div> : null}
    </div>
  </TarjetaSeccion>;
}
