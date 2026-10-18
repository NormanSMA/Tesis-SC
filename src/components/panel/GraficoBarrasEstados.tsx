import Link from "next/link";

import { agruparOtros, porcentajeVisible } from "@/lib/listas/numeros";
import type { GraficoPanel } from "@/modules/panel/tipos";

function datosVisibles(grafico: GraficoPanel) {
  return agruparOtros(grafico.datos, 6, (valor) => ({ clave: "otros", etiqueta: "Otros", valor }));
}

export function formatearDescripcionGrafico(grafico: GraficoPanel): string {
  const valores = datosVisibles(grafico).map(({ etiqueta, valor, texto }) => `${etiqueta}: ${texto ?? valor}`);
  const contexto = grafico.subtitulo ? ` (${grafico.subtitulo})` : "";
  return `${grafico.titulo}${contexto}. ${valores.length ? valores.join("; ") : "Sin datos"}.`;
}

function TablaGrafico({ grafico }: { grafico: GraficoPanel }) {
  return (
    <table className="sr-only">
      <caption>{grafico.titulo}. {grafico.subtitulo}</caption>
      <thead><tr><th scope="col">Categoría</th><th scope="col">Valor</th></tr></thead>
      <tbody>{datosVisibles(grafico).map(({ clave, etiqueta, valor, texto }, indice) => (
        <tr key={clave ?? `${etiqueta}-${indice}`}><th scope="row">{etiqueta}</th><td>{texto ?? valor}</td></tr>
      ))}</tbody>
    </table>
  );
}

export function GraficoBarrasEstados({ grafico }: { grafico: GraficoPanel }) {
  const datos = datosVisibles(grafico);
  const maximo = Math.max(0, ...datos.map(({ valor }) => valor));
  return (
    <section aria-label={grafico.titulo} className="h-full min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:p-5">
      <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{grafico.titulo}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{grafico.subtitulo}</p>
      <div role="img" aria-label={formatearDescripcionGrafico(grafico)} className="mt-5">
        <div aria-hidden="true" className="grid h-52 items-end gap-2 border-b border-border/80 pt-6"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, datos.length)}, minmax(0, 1fr))` }}>
          {datos.map(({ clave, etiqueta, valor, texto, destacado }, indice) => (
            <div key={clave ?? `${etiqueta}-${indice}`} className="flex h-full min-w-0 items-end justify-center">
              <div className={`animate-bar-grow relative w-full max-w-10 rounded-t-md motion-reduce:animate-none ${destacado ? "bg-primary" : "bg-slate-300"}`}
                style={{ height: `${porcentajeVisible(valor, maximo) * 0.85}%`, animationDelay: `${indice * 40}ms` }}>
                <span className="absolute bottom-full left-1/2 mb-2 max-w-[calc(100%+0.5rem)] -translate-x-1/2 text-center text-[11px] font-semibold tabular-nums [overflow-wrap:anywhere]">{texto ?? valor}</span>
              </div>
            </div>
          ))}
          {datos.length === 0 && <span className="self-center text-center text-xs text-muted-foreground">Sin datos</span>}
        </div>
        <div aria-hidden="true" className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, datos.length)}, minmax(0, 1fr))` }}>
          {datos.map(({ clave, etiqueta }, indice) => <span key={clave ?? `${etiqueta}-${indice}`} className="text-center text-[11px] leading-tight text-muted-foreground [overflow-wrap:anywhere]">{etiqueta}</span>)}
        </div>
      </div>
      <TablaGrafico grafico={grafico} />
      {grafico.nota && <Link href={grafico.nota.destino} className="mt-3 inline-flex min-h-10 items-center rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{grafico.nota.texto}</Link>}
    </section>
  );
}
