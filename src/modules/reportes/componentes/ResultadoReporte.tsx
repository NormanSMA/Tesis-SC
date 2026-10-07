import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { KpiCard } from "@/components/comunes/KpiCard";
import { formatearFechaHora } from "@/lib/formato";
import { columnasReporte, ETIQUETAS_TOTALES, TITULOS_REPORTES } from "../columnas";
import type { NombreReporte } from "../schema";
import type { FilaReporte, ReporteDto } from "../tipos";

export function ResultadoReporte({ nombre, reporte, dinero }: { nombre: NombreReporte; reporte: ReporteDto; dinero: boolean }) {
  const columnas: ColumnaTabla<FilaReporte>[] = columnasReporte(nombre, dinero).map((columna) => ({
    id: columna.campo, encabezado: columna.encabezado, celda: (fila) => fila[columna.campo] ?? "Sin dato",
    ...(columna.tipo !== "texto" && { alinear: "derecha" as const }),
  }));
  return <section aria-label="Resultado del reporte" className="min-w-0 space-y-4">
    <h2 className="text-lg font-semibold">{TITULOS_REPORTES[nombre]}</h2>
    <p className="text-sm text-muted-foreground">Generado: {formatearFechaHora(reporte.generadoEn)} (Managua).</p>
    <DataTable titulo={TITULOS_REPORTES[nombre]} columnas={columnas} filas={reporte.filas}
      idFila={(fila) => JSON.stringify(fila)} className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2"
      vacio={<EmptyState titulo="Sin resultados" descripcion="No hay registros con estos filtros." />} />
    <section aria-label="Totales del reporte" className="space-y-3"><h3 className="font-semibold">Totales</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&_p]:break-words [&_p]:[overflow-wrap:anywhere]">{Object.entries(reporte.totales).map(([campo, valor]) =>
        <KpiCard key={campo} etiqueta={ETIQUETAS_TOTALES[campo]} valor={valor} />)}</div></section>
  </section>;
}
