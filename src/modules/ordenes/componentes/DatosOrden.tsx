import Link from "next/link";
import { Fecha, Money } from "@/components/comunes/ValorFormateado";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { monedaDe } from "@/modules/cotizaciones/moneda";
import type { OrdenDto } from "../tipos";

export function DatosCliente({ orden, verCliente }: { orden: OrdenDto; verCliente: boolean }) {
  const cotizacion = orden.cotizacion;
  if (!cotizacion) return null;
  const moneda = monedaDe(cotizacion.moneda);
  const enlace = (href: string, texto: string) => <Link href={href} className="text-primary underline">{texto}</Link>;
  return <TarjetaSeccion titulo="Cliente y cotización" className="min-w-0">
    <div className="space-y-5">
      <ListaDatos datos={[
        { etiqueta: "Cliente", valor: verCliente ? enlace(`/clientes/${orden.cliente.id}`, orden.cliente.nombre) : orden.cliente.nombre },
        { etiqueta: "Tipo", valor: orden.cliente.tipo === "EMPRESA" ? "Empresa" : "Persona" },
        { etiqueta: "Teléfono", valor: orden.cliente.telefono || null }, { etiqueta: "Correo", valor: orden.cliente.correo || null },
        ...(verCliente ? [{ etiqueta: "RUC", valor: orden.cliente.ruc || null }, { etiqueta: "Dirección", valor: orden.cliente.direccion || null }] : []),
        { etiqueta: "Cotización", valor: enlace(`/cotizaciones/${cotizacion.id}`, cotizacion.numero) },
        { etiqueta: "Asunto", valor: cotizacion.asunto || null },
      ]} />
      {cotizacion.total !== undefined ? <ListaDatos className="border-t border-slate-100 pt-5" datos={[
        { etiqueta: "Subtotal", valor: <Money valor={cotizacion.subtotal} moneda={moneda} /> },
        { etiqueta: "Descuento", valor: <Money valor={cotizacion.descuento} moneda={moneda} /> },
        ...(Number(cotizacion.impuesto) !== 0
          ? [{ etiqueta: "Cargo histórico", valor: <Money valor={cotizacion.impuesto} moneda={moneda} /> }] : []),
        { etiqueta: "Total", valor: <Money valor={cotizacion.total} moneda={moneda} /> },
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
