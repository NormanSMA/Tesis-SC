import { BarChart3 } from "lucide-react";
import Link from "next/link";

import { agruparOtros, porcentajeVisible } from "@/lib/listas/numeros";
import { cn } from "@/lib/utils";
import type { GraficoPanel } from "@/modules/panel/tipos";

const CLAVE_FECHA = /^\d{4}-\d{2}/;

// Series de tiempo (clave con fecha): orden cronológico y últimos 7 puntos. Categorías: las 5 mayores y "Otros".
function datosVisibles(grafico: GraficoPanel) {
  const temporal = grafico.datos.length > 0 && grafico.datos.every(({ clave }) => clave !== undefined && CLAVE_FECHA.test(clave));
  // El periodo más reciente se resalta si el servicio no marcó ninguno.
  if (temporal) {
    const recientes = grafico.datos.slice(-7);
    if (recientes.some(({ destacado }) => destacado)) return recientes;
    return recientes.map((fila, indice) => ({ ...fila, destacado: indice === recientes.length - 1 }));
  }
  return agruparOtros(grafico.datos, 6, (valor) => ({ clave: "otros", etiqueta: "Otros", valor }));
}

export function formatearDescripcionGrafico(grafico: GraficoPanel): string {
  const valores = datosVisibles(grafico).map(({ etiqueta, valor, texto }) => `${etiqueta}: ${texto ?? valor}`);
  const contexto = grafico.subtitulo ? ` (${grafico.subtitulo})` : "";
  return `${grafico.titulo}${contexto}. ${valores.length ? valores.join("; ") : "Sin datos"}.`;
}

// La tabla va dentro de un div sr-only: una tabla con sr-only directo ignora el ancho de 1 px y desborda la página.
function TablaGrafico({ grafico }: { grafico: GraficoPanel }) {
  return (
    <div className="sr-only"><table>
      <caption>{grafico.titulo}. {grafico.subtitulo}</caption>
      <thead><tr><th scope="col">Categoría</th><th scope="col">Valor</th></tr></thead>
      <tbody>{datosVisibles(grafico).map(({ clave, etiqueta, valor, texto }, indice) => (
        <tr key={clave ?? `${etiqueta}-${indice}`}><th scope="row">{etiqueta}</th><td>{texto ?? valor}</td></tr>
      ))}</tbody>
    </table></div>
  );
}

/**
 * Distribución compacta en barras horizontales: etiqueta, barra y valor en una línea.
 * Se lee de un vistazo con 2 o con 6 categorías y no deja espacio vacío a todo el ancho.
 */
export function GraficoBarrasEstados({ grafico }: { grafico: GraficoPanel }) {
  const datos = datosVisibles(grafico);
  const maximo = Math.max(0, ...datos.map(({ valor }) => valor));
  return (
    <section aria-label={grafico.titulo} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3.5 lg:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-card text-slate-600">
          <BarChart3 aria-hidden="true" className="size-4" />
        </span>
        <h2 className="text-lg font-medium text-slate-900">{grafico.titulo}</h2>
        <span className="text-sm text-slate-500">{grafico.subtitulo}</span>
        {grafico.nota && <Link href={grafico.nota.destino} className="ml-auto inline-flex min-h-10 items-center rounded text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{grafico.nota.texto}</Link>}
      </div>
      <div role="img" aria-label={formatearDescripcionGrafico(grafico)} className="px-4 py-4 lg:px-5">
        {datos.length === 0 ? <p aria-hidden="true" className="py-4 text-center text-sm text-slate-500">Sin datos</p> : (
          <ul aria-hidden="true" className="flex flex-col gap-3">
            {datos.map(({ clave, etiqueta, valor, texto, destacado }, indice) => (
              <li key={clave ?? `${etiqueta}-${indice}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)_6.5rem] items-center gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_7rem]">
                <span className={cn("truncate text-sm", destacado ? "font-medium text-slate-900" : "text-slate-600")}>{etiqueta}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <span className={cn("block h-full rounded-full animate-bar-grow-x motion-reduce:animate-none", destacado ? "bg-primary" : "bg-slate-400")}
                    style={{ width: `${porcentajeVisible(valor, maximo)}%`, animationDelay: `${indice * 40}ms` }} />
                </span>
                <span className={cn("text-right text-sm tabular-nums", destacado ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>{texto ?? valor}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <TablaGrafico grafico={grafico} />
    </section>
  );
}
