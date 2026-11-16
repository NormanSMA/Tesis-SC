import { cn } from "@/lib/utils";
import { graficosReporte, textoGrafico, type DatosGrafico } from "../graficos";
import type { NombreReporte } from "../schema";
import type { ReporteDto } from "../tipos";

function GraficoReporte({ grafico }: { grafico: DatosGrafico }) {
  const maximo = Math.max(0, ...grafico.filas.flatMap(f => f.valores));
  return <figure className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
    <figcaption className="space-y-2 border-b bg-secondary/40 p-5"><h3 className="text-lg font-semibold">{grafico.titulo}</h3>
      <p className="text-sm text-muted-foreground">{grafico.descripcion}</p>
      <ul className="flex flex-wrap gap-4 text-sm">{grafico.series.map(s => <li key={s.clave} className="flex items-center gap-2">
        <span aria-hidden="true" className={cn("size-3 rounded-sm", s.tono === "principal" ? "bg-primary" : "bg-warning")} />{s.nombre}</li>)}</ul>
    </figcaption>
    <div className="max-h-[30rem] overflow-y-auto p-5" tabIndex={0} role="region" aria-label={grafico.titulo}>
      <p className="mb-4 flex justify-between border-b pb-2 text-xs text-muted-foreground"><span>Escala desde 0</span><span>Máximo: {textoGrafico(maximo, grafico.unidad)}</span></p>
      {!grafico.filas.length ? <p>Sin datos con estos filtros.</p> : <ul className="space-y-5">{grafico.filas.map((fila, i) => <li key={`${fila.nombre}-${i}`}>
        <p className="mb-2 text-sm font-medium">{fila.nombre}</p>
        <ul className="space-y-2">{fila.valores.map((valor, j) => <li key={grafico.series[j].clave} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3">
          <span aria-hidden="true" className="block h-3 overflow-hidden rounded-sm bg-secondary"><span className={cn("block h-full rounded-r-sm", grafico.series[j].tono === "principal" ? "bg-primary" : "bg-warning")}
            style={{ width: `${maximo ? valor / maximo * 100 : 0}%` }} /></span>
          <span className="text-right text-sm tabular-nums"><span className="sr-only">{grafico.series[j].nombre}: </span>{textoGrafico(valor, grafico.unidad)}</span>
        </li>)}</ul>
      </li>)}</ul>}
    </div>
  </figure>;
}
export function GraficosReporte(props: { nombre: NombreReporte; reporte: ReporteDto; dinero: boolean }) {
  return <section aria-label="Gráficos del reporte" className="grid min-w-0 gap-5 xl:grid-cols-2">
    {graficosReporte(props).map(grafico => <GraficoReporte key={grafico.titulo} grafico={grafico} />)}
  </section>;
}
