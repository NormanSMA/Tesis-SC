import { Timeline } from "@/components/comunes/Timeline";
import { Card } from "@/components/ui/card";
import { aEventoTimeline } from "../textoEvento";
import type { EventoOrden } from "../tipos";

export function LineaTiempoOrden({ eventos }: { eventos: EventoOrden[] }) {
  return <section aria-labelledby="titulo-tiempo"><h2 id="titulo-tiempo" className="mb-4 text-xl font-semibold">Línea de tiempo</h2>
    <Card className="min-w-0 break-words px-8 [overflow-wrap:anywhere]">
      {eventos.length ? <Timeline titulo="Historial de la orden" eventos={eventos.map(aEventoTimeline)} /> : <p>Sin eventos registrados.</p>}
    </Card>
  </section>;
}
