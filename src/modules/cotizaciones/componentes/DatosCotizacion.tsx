import Link from "next/link";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";
import type { CotizacionDto } from "../tipos";

export function DatosCotizacion({ cotizacion }: { cotizacion: CotizacionDto }) {
  return <Card className="px-5"><dl className="grid gap-4 text-sm sm:grid-cols-2">
    <div><dt className="text-muted-foreground">Cliente</dt><dd className="font-medium">{cotizacion.cliente.nombre}</dd></div>
    <div><dt className="text-muted-foreground">Estado</dt><dd className="mt-1"><EstadoBadge tipo="cotizacion" estado={cotizacion.estado} /></dd></div>
    <div><dt className="text-muted-foreground">Emisión</dt><dd><Fecha valor={cotizacion.fechaEmision} /></dd></div>
    <div><dt className="text-muted-foreground">Vencimiento</dt><dd><Fecha valor={cotizacion.fechaVencimiento} /></dd></div>
    <div><dt className="text-muted-foreground">Vigencia</dt><dd>{cotizacion.vigenciaDias} días</dd></div>
    {cotizacion.fechaRespuesta ? <div><dt className="text-muted-foreground">Respuesta</dt><dd><Fecha valor={cotizacion.fechaRespuesta} /></dd></div> : null}
    {cotizacion.cotizacionOrigenId ? <div><dt className="text-muted-foreground">Origen</dt><dd>
      <Link href={`/cotizaciones/${cotizacion.cotizacionOrigenId}`} className="text-primary underline">Ver cotización original</Link>
    </dd></div> : null}
    {cotizacion.motivoRechazo ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo del rechazo</dt><dd>{cotizacion.motivoRechazo}</dd></div> : null}
    <div className="sm:col-span-2"><dt className="text-muted-foreground">Condiciones comerciales</dt>
      <dd className="mt-1 whitespace-pre-wrap">{cotizacion.condiciones || "Sin condiciones adicionales."}</dd></div>
  </dl></Card>;
}
