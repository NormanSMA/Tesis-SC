import type { Metadata } from "next";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { prisma } from "@/lib/db";
import { FiltrosReportes } from "@/modules/reportes/componentes/FiltrosReportes";
import { ResultadoReporte } from "@/modules/reportes/componentes/ResultadoReporte";
import { enlaceExportacion, leerFiltrosPagina } from "@/modules/reportes/paginas";
import { obtenerReporte } from "@/modules/reportes/service";

export const metadata: Metadata = { title: "Reportes" };
export default async function PaginaReportes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await exigirPermisoPagina("reporte:ver");
  const filtros = leerFiltrosPagina(await searchParams);
  const [reporte, areas] = await Promise.all([
    filtros.valido ? obtenerReporte({ nombre: filtros.nombre, consulta: filtros.consulta, actor }) : undefined,
    prisma.area.findMany({ select: { id: true, nombre: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }),
  ]);
  return <><PageHeader titulo="Reportes" descripcion="Consulte indicadores y exporte información de la operación." acciones={
    reporte && can(actor, "reporte:exportar") ? <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline"><a href={enlaceExportacion(filtros.nombre, filtros.consulta, "xlsx")}>Exportar a Excel</a></Button>
      <Button asChild variant="ghost"><a href={enlaceExportacion(filtros.nombre, filtros.consulta, "csv")}>Exportar CSV</a></Button></div> : undefined} />
    <div className="min-w-0 space-y-6">
      {!filtros.valido ? <p role="alert" aria-live="assertive">Revise el reporte y los filtros antes de consultar.</p> : null}
      <FiltrosReportes key={JSON.stringify(filtros)} nombre={filtros.nombre} consulta={filtros.consulta} areas={areas} campos={filtros.campos} />
      {reporte ? <ResultadoReporte nombre={filtros.nombre} reporte={reporte} dinero={can(actor, "cotizacion:ver")} /> : null}
    </div></>;
}
