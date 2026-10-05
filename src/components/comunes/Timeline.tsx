import { formatearFechaHora } from "@/lib/formato";

export type EventoTimeline = {
  id: string;
  /** Instante ISO 8601 UTC. */
  instante: string;
  actor: string;
  accion: string;
  detalle?: string;
};

export function Timeline({ eventos, titulo }: { eventos: EventoTimeline[]; titulo: string }) {
  return (
    <ol aria-label={titulo} className="relative space-y-6 border-l-2 border-border pl-6">
      {eventos.map((evento) => (
        <li key={evento.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[31px] size-2.5 rounded-full border-2 border-card bg-primary ring-2 ring-primary-soft-border"
          />
          <time dateTime={evento.instante} className="text-xs font-medium text-muted-foreground tabular-nums">
            {formatearFechaHora(evento.instante)}
          </time>
          <p className="mt-0.5 text-sm text-foreground">
            <span className="font-semibold">{evento.actor}</span> {evento.accion}
          </p>
          {evento.detalle ? <p className="mt-0.5 text-sm text-muted-foreground">{evento.detalle}</p> : null}
        </li>
      ))}
    </ol>
  );
}
