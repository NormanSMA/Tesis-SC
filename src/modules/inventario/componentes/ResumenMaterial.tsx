import { BarraProgresoAnimada } from "@/components/comunes/BarraProgresoAnimada";
import { BandejaMetricas } from "@/components/comunes/TarjetaMetrica";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { formatearCantidad, formatearCantidadConUnidad, formatearCantidadPorUnidad } from "@/lib/formato";
import type { FichaMaterial } from "../dto";
import { etiquetaAlertaMaterial, tonoExistencia } from "./TablasInventario";

export function ResumenMaterial({ material }: { material: FichaMaterial }) {
  const minimo = Number(material.stockMinimo);
  const alerta = etiquetaAlertaMaterial(material.alerta);
  const { conciliacion } = material;
  return <div id="existencias-material" className="min-w-0 space-y-6">
    <BandejaMetricas className="grid-cols-2 md:grid-cols-3 lg:grid-cols-3 max-md:[&>*:last-child]:col-span-2">
      <TarjetaSeccion titulo="Existencia"><p className="text-3xl font-normal tracking-tight break-words tabular-nums">
        {formatearCantidadConUnidad(material.existencia, material.unidad)}</p></TarjetaSeccion>
      <TarjetaSeccion titulo="Stock mínimo"><p className="text-3xl font-normal tracking-tight break-words tabular-nums">
        {formatearCantidadConUnidad(material.stockMinimo, material.unidad)}</p></TarjetaSeccion>
      <TarjetaSeccion titulo="Costo promedio (C$)"><p className="text-3xl font-normal tracking-tight break-words tabular-nums">
        {formatearCantidad(material.costoPromedio, 4)}</p></TarjetaSeccion>
    </BandejaMetricas>
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
