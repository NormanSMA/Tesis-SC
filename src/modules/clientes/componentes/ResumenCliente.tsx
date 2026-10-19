import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { Money } from "@/components/comunes/ValorFormateado";

import type { ResumenCotizaciones } from "../tipos";

const ORDEN_ESTADOS = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA", "AJUSTE_SOLICITADO"];

export function ResumenCliente({ resumen, className }: { resumen: ResumenCotizaciones; className?: string }) {
  return (
    <TarjetaSeccion titulo="Resumen de cotizaciones" className={className}>
      <div className="space-y-4">
        <dl className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs font-medium text-slate-500">Cotizaciones</dt>
            <dd className="text-xl font-semibold tabular-nums text-foreground">{resumen.cotizaciones}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs font-medium text-slate-500">Total aprobado (C$ equivalente)</dt>
            <dd className="text-xl font-semibold whitespace-nowrap text-foreground">
              <Money valor={resumen.totalAprobado} />
            </dd>
          </div>
        </dl>
        <ul aria-label="Cotizaciones por estado" className="space-y-2 border-t border-slate-100 pt-4">
          {ORDEN_ESTADOS.map((estado) => (
            <li key={estado} className="flex items-center justify-between gap-3">
              {estado === "AJUSTE_SOLICITADO" ? <span className="text-xs font-medium">Ajustes solicitados</span> :
                <EstadoBadge tipo="cotizacion" estado={estado} />}
              <span className="text-sm font-medium tabular-nums text-foreground">{resumen.porEstado[estado] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </TarjetaSeccion>
  );
}
