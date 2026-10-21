import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { BandejaMetricas, TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import type { FormatoNumero } from "@/components/comunes/ContadorMetrica";
import { celdaVisible, columnasReporte, etiquetaVisible, ETIQUETAS_TOTALES, MONETARIAS, TITULOS_REPORTES, totalVisible } from "../columnas";
import type { NombreReporte } from "../schema";
import type { FilaReporte, ReporteDto, ValorReporte } from "../tipos";

// Valor crudo de un total: sin dato o no numérico queda en null (la tarjeta muestra guion).
function numeroTotal(valor: ValorReporte): number | null {
  if (valor === null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
function formatoTotal(campo: string): FormatoNumero {
  if (MONETARIAS.has(campo)) return "moneda";
  return campo === "tasaAprobacion" ? "porcentaje" : "entero";
}

// Una fila de tarjetas en escritorio, sin huecos: tantas columnas como totales.
const COLUMNAS_TOTALES: Record<number, string> = { 1: "lg:grid-cols-3", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" };

export function ResultadoReporte({ nombre, reporte, dinero }: { nombre: NombreReporte; reporte: ReporteDto; dinero: boolean }) {
  const columnas: ColumnaTabla<FilaReporte>[] = columnasReporte(nombre, dinero).map((columna) => ({
    id: columna.campo, encabezado: etiquetaVisible(columna.encabezado), celda: (fila) => celdaVisible(columna, fila),
    ...(columna.tipo !== "texto" && { alinear: "derecha" as const }),
  }));
  return <ZonaResultados><section aria-label="Resultado del reporte" className="min-w-0 space-y-4">
    {/* El selector ya nombra el reporte y el reloj da la hora: el título queda para lectores de pantalla. */}
    <h2 className="sr-only">{TITULOS_REPORTES[nombre]}</h2>
    <section aria-label="Totales del reporte" className="space-y-3"><h3 className="sr-only">Totales</h3>
      <BandejaMetricas className={COLUMNAS_TOTALES[Object.keys(reporte.totales).length] ?? "lg:grid-cols-3"}>{Object.entries(reporte.totales).map(([campo, valor]) =>
        <TarjetaMetrica key={campo} etiqueta={etiquetaVisible(ETIQUETAS_TOTALES[campo])} numero={numeroTotal(valor)}
          texto={String(totalVisible(campo, valor) ?? "")} formato={formatoTotal(campo)} textoExacto />)}</BandejaMetricas></section>
    <DataTable apilarEnMovil titulo={TITULOS_REPORTES[nombre]} columnas={columnas} filas={reporte.filas}
      idFila={(fila) => JSON.stringify(fila)} className="min-w-0 md:[&_table]:min-w-[40rem] [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2"
      vacio={<EmptyState ilustracion="video-marketing" titulo="Sin resultados" descripcion="No hay registros con estos filtros." />} />
  </section></ZonaResultados>;
}
