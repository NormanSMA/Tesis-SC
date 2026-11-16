import Link from "next/link";
import type { ReactNode } from "react";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { monedaDe } from "@/modules/cotizaciones/moneda";
import type { TrazabilidadOrden } from "../tipos";
import estilos from "./ResponsividadTrazabilidad.module.css";

const dato = (etiqueta: string, valor: ReactNode, ancho?: boolean) => ({ etiqueta, valor: valor || "Sin registrar", ancho });
function Registro({ nombre, href }: { nombre: string; href: string | null }) {
  return href ? <Link href={href} className="text-primary underline">{nombre}</Link> : <span>{nombre}</span>;
}
export function CadenaTrabajo({ cadena }: { cadena: TrazabilidadOrden["cadena"] }) {
  const { cotizacion } = cadena;
  return <section aria-label="Cadena vinculada" className={`min-w-0 ${estilos.cadena}`}>
    <TarjetaSeccion titulo="Cliente"><ListaDatos className={estilos.datosCadena} datos={[
      dato("Nombre", <Registro nombre={cadena.cliente.nombre} href={cadena.cliente.href} />),
      dato("Tipo", cadena.cliente.tipo), dato("Contacto", cadena.cliente.contactoPrincipal),
      dato("Teléfono", cadena.cliente.telefono), dato("Correo", cadena.cliente.correo),
      ...("ruc" in cadena.cliente ? [dato("RUC", cadena.cliente.ruc), dato("Dirección", cadena.cliente.direccion)] : []),
    ]} /></TarjetaSeccion>
    {cotizacion ? <TarjetaSeccion titulo="Cotización"><ListaDatos className={estilos.datosCadena} datos={[
      dato("Número", <Registro nombre={cotizacion.numero} href={cotizacion.href} />),
      dato("Asunto", cotizacion.asunto), dato("Estado", cotizacion.estado),
      dato("Creación", formatearFechaHora(cotizacion.creadoEn)),
      dato("Emisión", formatearFecha(cotizacion.fechaEmision)),
      dato("Vencimiento", formatearFecha(cotizacion.fechaVencimiento)),
      dato("Respuesta", formatearFechaHora(cotizacion.fechaRespuesta)),
      dato("Total", formatearMoneda(cotizacion.total, monedaDe(cotizacion.moneda))),
    ]} /></TarjetaSeccion> : null}
    <TarjetaSeccion titulo="Orden de trabajo" className={estilos.orden}><ListaDatos className={estilos.datosCadena} datos={[
      dato("Número", <Link href={`/ordenes/${cadena.orden.id}`} className="text-primary underline">{cadena.orden.numero}</Link>),
      dato("Estado", cadena.orden.estado), dato("Responsable", cadena.orden.responsable?.nombre ?? "Sin responsable"),
      dato("Especificaciones", cadena.orden.especificaciones, true), dato("Creación", formatearFechaHora(cadena.orden.creadoEn)),
      dato("Entrega planificada", formatearFecha(cadena.orden.fechaEntrega)),
      dato("Inicio real", formatearFechaHora(cadena.orden.fechaInicioReal)),
      dato("Entrega real", formatearFechaHora(cadena.orden.fechaEntregaReal)),
      dato("Cierre", formatearFechaHora(cadena.orden.fechaCierre)),
    ]} /></TarjetaSeccion>
  </section>;
}
