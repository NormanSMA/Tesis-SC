import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { formatearFechaHora } from "@/lib/formato";
import type { EtapaOrdenDto } from "../tipos";

const columnas: ColumnaTabla<EtapaOrdenDto>[] = [
  { id: "nombre", encabezado: "Etapa y área", principal: true, celda: (etapa) => <div className="space-y-1">
    <p className="font-medium">{etapa.secuencia}. {etapa.nombre}</p><p className="text-xs text-muted-foreground">{etapa.area.nombre}</p>
    {etapa.observaciones ? <p className="text-xs">{etapa.observaciones}</p> : null}</div> },
  { id: "estado", encabezado: "Estado y responsable", celda: (etapa) => <div className="space-y-2">
    <EstadoBadge tipo="etapa" estado={etapa.estado} /><p className="text-xs">{etapa.responsable?.nombre ?? "Sin responsable"}</p></div> },
  { id: "plan", encabezado: "Fechas planificadas", celda: (etapa) => <div className="space-y-1 text-xs">
    <p>Inicio: <Fecha valor={etapa.fechaInicioPlan} /></p><p>Fin: <Fecha valor={etapa.fechaFinPlan} /></p></div> },
  { id: "reales", encabezado: "Fechas reales", celda: (etapa) => <div className="space-y-1 text-xs">
    <p>Inicio: {formatearFechaHora(etapa.fechaInicioReal) || "—"}</p><p>Fin: {formatearFechaHora(etapa.fechaFinReal) || "—"}</p></div> },
];

export function EtapasOrden({ etapas }: { etapas: EtapaOrdenDto[] }) {
  return <section aria-labelledby="titulo-etapas"><h2 id="titulo-etapas" className="mb-2 text-xl font-semibold">Etapas</h2>
    <p className="mb-4 text-sm text-muted-foreground">Consulte las etapas y sus fechas.</p>
    <DataTable titulo="Etapas de la orden" columnas={columnas} filas={etapas} idFila={(etapa) => etapa.id}
      className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2" />
  </section>;
}
