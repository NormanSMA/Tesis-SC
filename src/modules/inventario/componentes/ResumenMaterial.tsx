import { BarraProgresoAnimada } from "@/components/comunes/BarraProgresoAnimada";
import { formatearCantidad, formatearCantidadConUnidad, formatearCantidadPorUnidad } from "@/lib/formato";
import type { FichaMaterial } from "../dto";
import { etiquetaAlertaMaterial, tonoExistencia } from "./TablasInventario";

/** Tarjeta de la ficha: existencia frente al mínimo, costo promedio y estado de conciliación del libro. */
export function ResumenMaterial({ material }: { material: FichaMaterial }) {
  const minimo = Number(material.stockMinimo);
  const alerta = etiquetaAlertaMaterial(material.alerta);
  const { conciliacion } = material;
  return <section aria-labelledby="existencias-material" className="min-w-0 space-y-4 rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm">
    <h2 id="existencias-material" className="text-lg font-medium text-slate-900">Existencias y conciliación</h2>
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
      <div className="min-w-0"><dt className="text-sm text-muted-foreground">Existencia</dt>
        <dd className="text-3xl font-normal tracking-tight text-slate-900 tabular-nums">{formatearCantidadConUnidad(material.existencia, material.unidad)}</dd></div>
      <div className="min-w-0"><dt className="text-sm text-muted-foreground">Stock mínimo</dt>
        <dd className="mt-1 tabular-nums">{formatearCantidadConUnidad(material.stockMinimo, material.unidad)}</dd></div>
      <div className="min-w-0"><dt className="text-sm text-muted-foreground">Costo promedio (C$)</dt>
        <dd className="mt-1 tabular-nums">{formatearCantidad(material.costoPromedio, 4)}</dd></div>
    </dl>
    {minimo > 0 ? <BarraProgresoAnimada valor={Number(material.existencia)} total={minimo} tono={tonoExistencia(material)}
      etiqueta="Existencia frente al stock mínimo" texto={`Mín. ${formatearCantidadPorUnidad(material.stockMinimo, material.unidad)}`} /> : null}
    {alerta ? <p role="status" className="font-medium">{alerta}</p> : null}
    <p role={conciliacion.conciliado ? "status" : "alert"} className="border-t border-slate-100 pt-4 text-sm">
      {conciliacion.conciliado ? "Conciliado" : "Diferencia de integridad"}
      : existencia {formatearCantidadPorUnidad(conciliacion.existencia, material.unidad)}; suma del libro {formatearCantidadPorUnidad(conciliacion.sumaLibro, material.unidad)}.</p>
    {material.descripcion ? <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">{material.descripcion}</p> : null}
  </section>;
}
