import Link from "next/link";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";
import type { CotizacionDto } from "../tipos";

/** Datos secundarios de la ficha: fechas, origen y condiciones. Sección plegable. */
export function DatosCotizacion({ cotizacion }: { cotizacion: CotizacionDto }) {
  return <Card className="px-5"><details>
    <summary className="flex min-h-10 cursor-pointer items-center rounded-md text-base font-semibold focus-visible:outline-2 focus-visible:outline-ring">
      Condiciones y fechas
    </summary>
    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Emisión</dt><dd><Fecha valor={cotizacion.fechaEmision} /></dd></div>
      <div><dt className="text-muted-foreground">Vencimiento</dt><dd><Fecha valor={cotizacion.fechaVencimiento} /></dd></div>
      <div><dt className="text-muted-foreground">Vigencia</dt><dd>{cotizacion.vigenciaDias} días</dd></div>
      {cotizacion.fechaRespuesta ? <div><dt className="text-muted-foreground">Respuesta</dt><dd><Fecha valor={cotizacion.fechaRespuesta} /></dd></div> : null}
      {cotizacion.cotizacionOrigenId ? <div><dt className="text-muted-foreground">Origen</dt><dd>
        <Link href={`/cotizaciones/${cotizacion.cotizacionOrigenId}`} className="inline-flex min-h-10 items-center text-primary underline">Ver cotización original</Link>
      </dd></div> : null}
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Condiciones comerciales</dt>
        <dd className="mt-1 whitespace-pre-wrap">{cotizacion.condiciones || "Sin condiciones adicionales."}</dd></div>
    </dl>
  </details></Card>;
}
