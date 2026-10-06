import { Card } from "@/components/ui/card";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Money } from "@/components/comunes/ValorFormateado";

import type { ResumenCotizaciones } from "../tipos";

const ORDEN_ESTADOS = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA"];

export function ResumenCliente({ resumen, className }: { resumen: ResumenCotizaciones; className?: string }) {
  return (
    <Card className={className} aria-labelledby="resumen-cliente">
      <div className="space-y-5 px-5">
        <h2 id="resumen-cliente" className="text-xl font-semibold tracking-tight text-foreground">
          Resumen de cotizaciones
        </h2>
        <dl className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-medium text-muted-foreground">Cotizaciones</dt>
            <dd className="text-xl font-semibold tabular-nums text-foreground">{resumen.cotizaciones}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-medium text-muted-foreground">Total aprobado</dt>
            <dd className="text-xl font-semibold whitespace-nowrap text-foreground">
              <Money valor={resumen.totalAprobado} />
            </dd>
          </div>
        </dl>
        <ul aria-label="Cotizaciones por estado" className="space-y-2 border-t pt-4">
          {ORDEN_ESTADOS.map((estado) => (
            <li key={estado} className="flex items-center justify-between gap-3">
              <EstadoBadge tipo="cotizacion" estado={estado} />
              <span className="text-sm font-medium tabular-nums text-foreground">{resumen.porEstado[estado] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
