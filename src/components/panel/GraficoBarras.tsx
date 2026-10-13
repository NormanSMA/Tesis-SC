import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { GraficoPanel } from "@/modules/panel/tipos";

export function formatearDescripcionGrafico(grafico: GraficoPanel): string {
  const valores = grafico.datos.map(({ etiqueta, valor, texto }) => `${etiqueta}: ${texto ?? valor}`);
  const contexto = grafico.subtitulo ? ` (${grafico.subtitulo})` : "";
  return `${grafico.titulo}${contexto}. ${valores.length ? valores.join("; ") : "Sin datos"}.`;
}

// Ancho mínimo por barra: bajo este ancho el gráfico se desplaza en horizontal en vez de partir palabras.
const ANCHO_MINIMO_BARRA = "64px";

export function GraficoBarras({ grafico }: { grafico: GraficoPanel }) {
  const maximo = Math.max(0, ...grafico.datos.map(({ valor }) => valor));

  return (
    <section aria-label={grafico.titulo} className="h-full min-w-0">
      <Card className="h-full gap-0 rounded-2xl px-5 shadow-none">
        <h2 className="text-base font-semibold [overflow-wrap:anywhere]">{grafico.titulo}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">{grafico.subtitulo}</p>
        <div
          role="img"
          aria-label={formatearDescripcionGrafico(grafico)}
          tabIndex={0}
          className="mt-4 flex min-h-64 flex-1 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <div
            className="grid min-h-64 flex-1 items-end gap-2 pt-6 sm:gap-3.5"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, grafico.datos.length)}, minmax(${ANCHO_MINIMO_BARRA}, 1fr))` }}
          >
            {grafico.datos.map(({ etiqueta, valor, texto, destacado }, indice) => (
              <div key={`${etiqueta}-${indice}`} aria-hidden="true" className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                <div className="flex w-full min-h-0 flex-1 items-end justify-center">
                  <div
                    className={`barra-crece relative w-full max-w-16 rounded-t-xl rounded-b-md border ${destacado ? "border-primary bg-primary ring-2 ring-primary ring-offset-2 ring-offset-card" : "border-[var(--chart-series-border)] bg-[var(--chart-series)]"}`}
                    style={{ height: `${maximo > 0 ? Math.max(0, valor) / maximo * 80 : 0}%` }}
                  >
                    <span className={`absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap text-center text-[11px] font-semibold tabular-nums sm:text-xs ${destacado ? "text-primary underline underline-offset-2" : "text-muted-foreground"}`}>
                      {texto ?? valor}
                    </span>
                  </div>
                </div>
                <span className="min-h-8 w-full text-center text-[11px] text-muted-foreground [overflow-wrap:normal] [hyphens:none] sm:text-xs">{etiqueta}</span>
              </div>
            ))}
            {grafico.datos.length === 0 && <span aria-hidden="true" className="self-center text-center text-sm text-muted-foreground">Sin datos</span>}
          </div>
        </div>
        {grafico.nota && (
          <p className="mt-4 text-sm">
            <Link href={grafico.nota.destino} className="inline-flex min-h-10 min-w-10 items-center rounded font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {grafico.nota.texto}
            </Link>
          </p>
        )}
      </Card>
    </section>
  );
}
