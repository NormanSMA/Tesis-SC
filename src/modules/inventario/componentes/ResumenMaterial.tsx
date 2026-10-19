import { BarraProgresoAnimada } from "@/components/comunes/BarraProgresoAnimada";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { formatearCantidad, formatearCantidadConUnidad, formatearCantidadPorUnidad } from "@/lib/formato";
import type { FichaMaterial } from "../dto";
import { etiquetaAlertaMaterial, tonoExistencia } from "./TablasInventario";

export function ResumenMaterial({ material }: { material: FichaMaterial }) {
  const minimo = Number(material.stockMinimo);
  const alerta = etiquetaAlertaMaterial(material.alerta);
  const { conciliacion } = material;
  return <div id="existencias-material" className="min-w-0 space-y-6">
    {/* Cifras como lista de definiciones con aspecto de tarjeta de métrica: etiqueta arriba, valor grande. */}
    <dl className="grid min-w-0 grid-cols-2 gap-1.5 rounded-[20px] border border-slate-200/70 bg-slate-100/80 p-1.5 md:grid-cols-3 max-md:[&>*:last-child]:col-span-2">
      {[
        { etiqueta: "Existencia", valor: formatearCantidadConUnidad(material.existencia, material.unidad) },
        { etiqueta: "Stock mínimo", valor: formatearCantidadConUnidad(material.stockMinimo, material.unidad) },
        { etiqueta: "Costo promedio (C$)", valor: formatearCantidad(material.costoPromedio, 4) },
      ].map((cifra) => <div key={cifra.etiqueta} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
        <dt className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{cifra.etiqueta}</dt>
        <dd className="px-4 py-4 text-3xl font-normal tracking-tight break-words text-slate-900 tabular-nums">{cifra.valor}</dd>
      </div>)}
    </dl>
    <TarjetaSeccion titulo="Existencias y conciliación"><div className="space-y-4">
    {minimo > 0 ? <BarraProgresoAnimada valor={Number(material.existencia)} total={minimo} tono={tonoExistencia(material)}
      etiqueta="Existencia frente al stock mínimo" texto={`Mín. ${formatearCantidadPorUnidad(material.stockMinimo, material.unidad)}`} /> : null}
    {alerta ? <p role="status" className="font-medium">{alerta}</p> : null}
    <p role={conciliacion.conciliado ? "status" : "alert"} className="text-sm break-words">
      {conciliacion.conciliado ? "Conciliado" : "Diferencia de integridad"}
      : existencia {formatearCantidadPorUnidad(conciliacion.existencia, material.unidad)}; suma del libro {formatearCantidadPorUnidad(conciliacion.sumaLibro, material.unidad)}.</p>
    {material.descripcion ? <ListaDatos datos={[{ etiqueta: "Descripción", ancho: true,
      valor: <span className="whitespace-pre-wrap">{material.descripcion}</span> }]} /> : null}
    </div></TarjetaSeccion>
  </div>;
}
