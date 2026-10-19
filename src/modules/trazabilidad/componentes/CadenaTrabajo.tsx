import Link from "next/link";
import type { ReactNode } from "react";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { monedaDe } from "@/modules/cotizaciones/moneda";
import type { TrazabilidadOrden } from "../tipos";

const dato = (etiqueta: string, valor: ReactNode, ancho?: boolean) => ({ etiqueta, valor: valor || "Sin registrar", ancho });
function Registro({ nombre, href }: { nombre: string; href: string | null }) {
  return href ? <Link href={href} className="text-primary underline">{nombre}</Link> : <span>{nombre}</span>;
}
export function CadenaTrabajo({ cadena }: { cadena: TrazabilidadOrden["cadena"] }) {
  return <section aria-label="Cadena vinculada" className="grid min-w-0 gap-4 xl:grid-cols-3">
    <TarjetaSeccion titulo="Cliente"><ListaDatos className="xl:grid-cols-1" datos={[
      dato("Nombre", <Registro nombre={cadena.cliente.nombre} href={cadena.cliente.href} />),
      dato("Tipo", cadena.cliente.tipo), dato("Contacto", cadena.cliente.contactoPrincipal),
      dato("Teléfono", cadena.cliente.telefono), dato("Correo", cadena.cliente.correo),
      ...("ruc" in cadena.cliente ? [dato("RUC", cadena.cliente.ruc), dato("Dirección", cadena.cliente.direccion)] : []),
    ]} /></TarjetaSeccion>
    <TarjetaSeccion titulo="Cotización"><ListaDatos className="xl:grid-cols-1" datos={[
      dato("Número", <Registro nombre={cadena.cotizacion.numero} href={cadena.cotizacion.href} />),
      dato("Asunto", cadena.cotizacion.asunto), dato("Estado", cadena.cotizacion.estado),
      dato("Creación", formatearFechaHora(cadena.cotizacion.creadoEn)),
      dato("Emisión", formatearFecha(cadena.cotizacion.fechaEmision)),
      dato("Vencimiento", formatearFecha(cadena.cotizacion.fechaVencimiento)),
      dato("Respuesta", formatearFechaHora(cadena.cotizacion.fechaRespuesta)),
      ...("total" in cadena.cotizacion ? [dato("Total", formatearMoneda(cadena.cotizacion.total, monedaDe(cadena.cotizacion.moneda)))] : []),
    ]} /></TarjetaSeccion>
    <TarjetaSeccion titulo="Orden de trabajo"><ListaDatos className="xl:grid-cols-1" datos={[
      dato("Número", <Link href={`/ordenes/${cadena.orden.id}`} className="text-primary underline">{cadena.orden.numero}</Link>),
      dato("Estado", cadena.orden.estado), dato("Responsable", cadena.orden.responsable?.nombre ?? "Sin responsable"),
      dato("Especificaciones", cadena.orden.especificaciones), dato("Creación", formatearFechaHora(cadena.orden.creadoEn)),
      dato("Entrega planificada", formatearFecha(cadena.orden.fechaEntrega)),
      dato("Inicio real", formatearFechaHora(cadena.orden.fechaInicioReal)),
      dato("Entrega real", formatearFechaHora(cadena.orden.fechaEntregaReal)),
      dato("Cierre", formatearFechaHora(cadena.orden.fechaCierre)),
    ]} /></TarjetaSeccion>
  </section>;
}
