import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { GraficoPanel } from "@/modules/panel/tipos";

export function formatearDescripcionGrafico(grafico: GraficoPanel): string {
  const valores = grafico.datos.map(({ etiqueta, valor }) => `${etiqueta}: ${valor}`);
  const contexto = grafico.subtitulo ? ` (${grafico.subtitulo})` : "";
  return `${grafico.titulo}${contexto}. ${valores.length ? valores.join("; ") : "Sin datos"}.`;
}

export function GraficoBarras({ grafico }: { grafico: GraficoPanel }) {
  const maximo = Math.max(0, ...grafico.datos.map(({ valor }) => valor));

  return (
    <section aria-label={grafico.titulo} className="min-w-0">
      <Card className="gap-0 rounded-2xl px-5 shadow-none">
        <h2 className="text-base font-semibold [overflow-wrap:anywhere]">{grafico.titulo}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">{grafico.subtitulo}</p>
        <div
          role="img"
          aria-label={formatearDescripcionGrafico(grafico)}
          className="mt-4 grid h-64 items-end gap-2 pt-6 sm:gap-3.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, grafico.datos.length)}, minmax(0, 1fr))` }}
        >
          {grafico.datos.map(({ etiqueta, valor, destacado }, indice) => (
            <div key={`${etiqueta}-${indice}`} aria-hidden="true" className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <div className="flex w-full min-h-0 flex-1 items-end justify-center">
                <div
                  className={`relative w-full max-w-16 rounded-t-xl rounded-b-md border border-primary ${destacado ? "bg-primary" : "bg-primary-soft-border"}`}
                  style={{ height: `${maximo > 0 ? Math.max(0, valor) / maximo * 80 : 0}%` }}
                >
                  <span className={`absolute bottom-full left-0 mb-2 w-full text-center text-xs font-semibold tabular-nums [overflow-wrap:anywhere] ${destacado ? "text-primary" : "text-muted-foreground"}`}>
                    {valor}
                  </span>
                </div>
              </div>
              <span className="min-h-8 w-full text-center text-xs text-muted-foreground [overflow-wrap:anywhere]">{etiqueta}</span>
            </div>
          ))}
          {grafico.datos.length === 0 && <span aria-hidden="true" className="self-center text-center text-sm text-muted-foreground">Sin datos</span>}
        </div>
        {grafico.nota && (
          <p className="mt-4 flex flex-wrap items-center justify-between gap-x-3 text-sm text-muted-foreground">
            <span className="min-w-0 [overflow-wrap:anywhere]">{grafico.nota.texto}</span>
            <Link href={grafico.nota.destino} className="inline-flex min-h-10 min-w-10 items-center rounded font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Ver en Reportes
            </Link>
          </p>
        )}
      </Card>
    </section>
  );
}
