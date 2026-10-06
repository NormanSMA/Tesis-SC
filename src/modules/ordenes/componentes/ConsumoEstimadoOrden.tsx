import { CircleAlert } from "lucide-react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatearCantidad } from "@/lib/formato";
import type { OrdenDto } from "../tipos";

type Consumo = OrdenDto["consumosEstimados"][number];
const columnas: ColumnaTabla<Consumo>[] = [
  { id: "material", encabezado: "Material", principal: true, celda: (consumo) => consumo.material.nombre },
  { id: "cantidad", encabezado: "Cantidad", alinear: "derecha", celda: (consumo) => formatearCantidad(consumo.cantidad, 3) },
  { id: "unidad", encabezado: "Unidad", celda: (consumo) => consumo.material.unidad },
];

export function ConsumoEstimadoOrden({ orden }: { orden: OrdenDto }) {
  return <section aria-labelledby="titulo-estimado"><h2 id="titulo-estimado" className="mb-2 text-xl font-semibold">Consumo estimado</h2>
    <p className="mb-4 text-sm text-muted-foreground">Previsión de materiales. No reserva ni descuenta existencias.</p>
    <div className="space-y-4">
      {orden.advertencias.map((advertencia) => <Alert key={`${advertencia.itemSecuencia}-${advertencia.lineaSecuencia}`} role="status">
        <CircleAlert aria-hidden="true" /><AlertTitle>Material sin estimación</AlertTitle>
        <AlertDescription>{advertencia.mensaje}</AlertDescription></Alert>)}
      <DataTable titulo="Consumo estimado de materiales" columnas={columnas} filas={orden.consumosEstimados} idFila={(consumo) => consumo.id}
        className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words" />
    </div>
  </section>;
}
