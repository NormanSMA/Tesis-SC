import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import type { TrazabilidadOrden } from "../tipos";

function Dato({ nombre, valor }: { nombre: string; valor: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{nombre}</dt><dd className="break-words">{valor || "Sin registrar"}</dd></div>;
}
function Registro({ nombre, href }: { nombre: string; href: string | null }) {
  return href ? <Link href={href} className="text-primary underline">{nombre}</Link> : <span>{nombre}</span>;
}
export function CadenaTrabajo({ cadena }: { cadena: TrazabilidadOrden["cadena"] }) {
  return <section aria-label="Cadena vinculada" className="grid min-w-0 gap-4 xl:grid-cols-3">
    <Card className="min-w-0"><CardHeader><CardTitle><h2>Cliente</h2></CardTitle></CardHeader><CardContent><dl className="space-y-3">
      <Dato nombre="Nombre" valor={<Registro nombre={cadena.cliente.nombre} href={cadena.cliente.href} />} />
      <Dato nombre="Tipo" valor={cadena.cliente.tipo} /><Dato nombre="Contacto" valor={cadena.cliente.contactoPrincipal} />
      <Dato nombre="Teléfono" valor={cadena.cliente.telefono} /><Dato nombre="Correo" valor={cadena.cliente.correo} />
      {"ruc" in cadena.cliente ? <><Dato nombre="RUC" valor={cadena.cliente.ruc} /><Dato nombre="Dirección" valor={cadena.cliente.direccion} /></> : null}
    </dl></CardContent></Card>
    <Card className="min-w-0"><CardHeader><CardTitle><h2>Cotización</h2></CardTitle></CardHeader><CardContent><dl className="space-y-3">
      <Dato nombre="Número" valor={<Registro nombre={cadena.cotizacion.numero} href={cadena.cotizacion.href} />} />
      <Dato nombre="Asunto" valor={cadena.cotizacion.asunto} /><Dato nombre="Estado" valor={cadena.cotizacion.estado} />
      <Dato nombre="Creación" valor={formatearFechaHora(cadena.cotizacion.creadoEn)} />
      <Dato nombre="Emisión" valor={formatearFecha(cadena.cotizacion.fechaEmision)} />
      <Dato nombre="Vencimiento" valor={formatearFecha(cadena.cotizacion.fechaVencimiento)} />
      <Dato nombre="Respuesta" valor={formatearFechaHora(cadena.cotizacion.fechaRespuesta)} />
      {"total" in cadena.cotizacion ? <Dato nombre="Total" valor={formatearMoneda(cadena.cotizacion.total)} /> : null}
    </dl></CardContent></Card>
    <Card className="min-w-0"><CardHeader><CardTitle><h2>Orden de trabajo</h2></CardTitle></CardHeader><CardContent><dl className="space-y-3">
      <Dato nombre="Número" valor={<Link href={`/ordenes/${cadena.orden.id}`} className="text-primary underline">{cadena.orden.numero}</Link>} />
      <Dato nombre="Estado" valor={cadena.orden.estado} /><Dato nombre="Responsable" valor={cadena.orden.responsable?.nombre ?? "Sin responsable"} />
      <Dato nombre="Especificaciones" valor={cadena.orden.especificaciones} />
      <Dato nombre="Creación" valor={formatearFechaHora(cadena.orden.creadoEn)} />
      <Dato nombre="Entrega planificada" valor={formatearFecha(cadena.orden.fechaEntrega)} />
      <Dato nombre="Inicio real" valor={formatearFechaHora(cadena.orden.fechaInicioReal)} />
      <Dato nombre="Entrega real" valor={formatearFechaHora(cadena.orden.fechaEntregaReal)} />
      <Dato nombre="Cierre" valor={formatearFechaHora(cadena.orden.fechaCierre)} />
    </dl></CardContent></Card>
  </section>;
}
