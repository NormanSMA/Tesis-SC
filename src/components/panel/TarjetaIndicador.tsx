import Link from "next/link";
import type { IndicadorPanel } from "@/modules/panel/tipos";

const flechas = { sube: "▲", baja: "▼", igual: "=" } as const;
const coloresTendencia = {
  sube: "bg-success-soft text-success",
  baja: "bg-danger-soft text-danger",
  igual: "bg-muted text-muted-foreground",
} as const;

export function TarjetaIndicador({ indicador }: { indicador: IndicadorPanel }) {
  const { etiqueta, valor, contexto, destino, tendencia, alerta } = indicador;

  return (
    <Link
      href={destino}
      className="flex min-h-10 min-w-0 flex-col gap-1 rounded-2xl border bg-card p-5 text-card-foreground hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{etiqueta}</span>
      <span className={`text-3xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] ${alerta ? "text-danger" : "text-card-foreground"}`}>
        {valor}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-sm [overflow-wrap:anywhere]">
        {tendencia && (
          <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${alerta ? "bg-danger-soft text-danger" : coloresTendencia[tendencia.direccion]}`}>
            <span aria-hidden="true">{flechas[tendencia.direccion]}</span>
            <span className="sr-only">{tendencia.direccion === "igual" ? "Sin cambio:" : tendencia.direccion === "sube" ? "Aumento:" : "Disminución:"}</span>
            {tendencia.texto}
          </span>
        )}
        <span>{contexto}</span>
      </span>
    </Link>
  );
}
