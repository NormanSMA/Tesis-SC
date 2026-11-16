import { CircleAlert } from "lucide-react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatearCantidadPorUnidad } from "@/lib/formato";
import { agruparMaterialesPorArea } from "../materiales-por-area";
import type { OrdenDto } from "../tipos";

type Consumo = OrdenDto["consumosEstimados"][number];
const columnas: ColumnaTabla<Consumo>[] = [
  { id: "material", encabezado: "Material", principal: true, celda: (consumo) => consumo.material.nombre },
  { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (consumo) => formatearCantidadPorUnidad(consumo.cantidad, consumo.material.unidad) },
  { id: "unidad", encabezado: "Unidad", celda: (consumo) => consumo.material.unidad },
];
const columnasSinEstimacion: ColumnaTabla<OrdenDto["materialesSinEstimacion"][number]>[] = [
  { id: "nombre", encabezado: "Material", principal: true, celda: ({ nombre }) => nombre },
  { id: "cantidad", encabezado: "Cantidad cotizada", alinear: "derecha", celda: ({ cantidad, unidad }) => formatearCantidadPorUnidad(cantidad, unidad) },
  { id: "unidad", encabezado: "Unidad", celda: ({ unidad }) => unidad },
];

export function ConsumoEstimadoOrden({ orden }: { orden: OrdenDto }) {
  const grupos = agruparMaterialesPorArea(orden.consumosEstimados);
  return <section aria-labelledby="titulo-estimado"><h2 id="titulo-estimado" className="mb-2 text-xl font-semibold">Consumo estimado</h2>
    <p className="mb-4 text-sm text-muted-foreground">Previsión de materiales. No reserva ni descuenta existencias.</p>
    <div className="space-y-4">
      {orden.advertencias.map((advertencia) => <Alert key={`${advertencia.itemSecuencia}-${advertencia.lineaSecuencia}`} role="status">
        <CircleAlert aria-hidden="true" /><AlertTitle>Material sin estimación</AlertTitle>
        <AlertDescription>{advertencia.mensaje}</AlertDescription></Alert>)}
      {grupos.length ? grupos.map(({ area, titulo, filas }) => <div key={area ?? "sin-clasificar"} className="space-y-2">
        <h3 className="font-semibold">{titulo}</h3>
        <DataTable titulo={area ? `Consumo estimado · ${titulo}` : "Consumo estimado de materiales"}
          columnas={columnas} filas={filas} idFila={(consumo) => consumo.id}
          className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words" />
      </div>) : <p className="text-sm text-muted-foreground">La orden no tiene materiales estimados en Inventario.</p>}
      {orden.materialesSinEstimacion.length ? <div className="space-y-2">
        <h3 className="font-semibold">Materiales cotizados sin estimación de Inventario</h3>
        <p className="text-sm text-muted-foreground">Incluye materiales ingresados manualmente y líneas cuya unidad no pudo conciliarse con Inventario.</p>
        <DataTable titulo="Materiales cotizados sin estimación de Inventario"
          columnas={columnasSinEstimacion} filas={orden.materialesSinEstimacion} idFila={({ id }) => id} />
      </div> : null}
    </div>
  </section>;
}
