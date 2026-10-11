import type { ReactNode } from "react";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";
import type { CotizacionDto } from "../tipos";
import { EstadoCotizacion } from "./EstadoCotizacion";

/** Resumen de la ficha: cliente, versión, estado y resultado de la respuesta, con el siguiente paso en `children`. */
export function EncabezadoCotizacion({ cotizacion, children }: { cotizacion: CotizacionDto; children: ReactNode }) {
  const respuesta = cotizacion.usuarioAprobacion || cotizacion.referenciaAprobacion || cotizacion.motivoRechazo || cotizacion.motivoAjuste;
  return <Card className="px-5" aria-label="Resumen de la cotización">
    <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0"><dt className="text-muted-foreground">Cliente</dt><dd className="break-words font-medium">{cotizacion.cliente.nombre}</dd></div>
      <div><dt className="text-muted-foreground">Estado</dt><dd className="mt-1"><EstadoCotizacion estado={cotizacion.estado} /></dd></div>
      <div><dt className="text-muted-foreground">Versión</dt><dd>Versión {cotizacion.version}</dd></div>
      <div><dt className="text-muted-foreground">Vencimiento</dt><dd><Fecha valor={cotizacion.fechaVencimiento} /></dd></div>
    </dl>
    {respuesta ? <dl className="grid gap-4 rounded-md bg-muted p-4 text-sm sm:grid-cols-2">
      {cotizacion.usuarioAprobacion ? <div><dt className="text-muted-foreground">Aprobación registrada por</dt>
        <dd className="font-medium">{cotizacion.usuarioAprobacion.nombre}</dd></div> : null}
      {cotizacion.referenciaAprobacion ? <div className="min-w-0"><dt className="text-muted-foreground">Referencia de aprobación</dt>
        <dd className="break-words font-medium">{cotizacion.referenciaAprobacion}</dd></div> : null}
      {cotizacion.motivoRechazo ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo del rechazo</dt>
        <dd className="break-words">{cotizacion.motivoRechazo}</dd></div> : null}
      {cotizacion.motivoAjuste ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo del ajuste</dt>
        <dd className="break-words">{cotizacion.motivoAjuste}</dd></div> : null}
    </dl> : null}
    <div className="border-t pt-4">{children}</div>
  </Card>;
}
