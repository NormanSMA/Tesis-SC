import Link from "next/link";
import type { ReactNode } from "react";
import { Money } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";
import { formatearFechaHora } from "@/lib/formato";
import type { OrdenDto } from "../tipos";

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-sm text-muted-foreground">{etiqueta}</dt>
    <dd className="mt-1 break-words [overflow-wrap:anywhere]">{children || "—"}</dd></div>;
}

export function DatosCliente({ orden, verCliente, verCotizacion }: { orden: OrdenDto; verCliente: boolean; verCotizacion: boolean }) {
  return <Card className="min-w-0 px-5"><h2 className="text-lg font-semibold">Cliente y cotización</h2>
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Dato etiqueta="Cliente">{verCliente ? <Link href={`/clientes/${orden.cliente.id}`} className="text-primary underline">
        {orden.cliente.nombre}</Link> : orden.cliente.nombre}</Dato>
      <Dato etiqueta="Tipo">{orden.cliente.tipo === "EMPRESA" ? "Empresa" : "Persona"}</Dato>
      <Dato etiqueta="Teléfono">{orden.cliente.telefono}</Dato><Dato etiqueta="Correo">{orden.cliente.correo}</Dato>
      {verCliente ? <><Dato etiqueta="RUC">{orden.cliente.ruc}</Dato><Dato etiqueta="Dirección">{orden.cliente.direccion}</Dato></> : null}
      <Dato etiqueta="Cotización">{verCotizacion ? <Link href={`/cotizaciones/${orden.cotizacion.id}`} className="text-primary underline">
        {orden.cotizacion.numero}</Link> : orden.cotizacion.numero}</Dato>
      <Dato etiqueta="Asunto">{orden.cotizacion.asunto}</Dato>
    </dl>
    {orden.cotizacion.total !== undefined ? <dl className="grid gap-4 sm:grid-cols-2">
      <Dato etiqueta="Subtotal"><Money valor={orden.cotizacion.subtotal} /></Dato>
      <Dato etiqueta="Descuento"><Money valor={orden.cotizacion.descuento} /></Dato>
      <Dato etiqueta={`IVA (${orden.cotizacion.tasaImpuesto} %)`}><Money valor={orden.cotizacion.impuesto} /></Dato>
      <Dato etiqueta="Total"><Money valor={orden.cotizacion.total} /></Dato></dl> : null}
  </Card>;
}

export function DatosOrden({ orden }: { orden: OrdenDto }) {
  return <Card className="min-w-0 px-5"><h2 className="text-lg font-semibold">Datos de la orden</h2>
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Dato etiqueta="Categoría">{orden.categoria.nombre}</Dato>
      <Dato etiqueta="Inicio real">{formatearFechaHora(orden.fechaInicioReal)}</Dato>
      <Dato etiqueta="Entrega real">{formatearFechaHora(orden.fechaEntregaReal)}</Dato>
      <Dato etiqueta="Cierre">{formatearFechaHora(orden.fechaCierre)}</Dato>
      <Dato etiqueta="Creación">{formatearFechaHora(orden.creadoEn)}</Dato>
    </dl>
    <div><h3 className="font-medium">Especificaciones</h3><p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {orden.especificaciones || "Sin especificaciones."}</p></div>
    {orden.motivoCancelacion ? <div><h3 className="font-medium">Motivo de cancelación</h3>
      <p className="mt-2 break-words [overflow-wrap:anywhere]">{orden.motivoCancelacion}</p></div> : null}
  </Card>;
}
