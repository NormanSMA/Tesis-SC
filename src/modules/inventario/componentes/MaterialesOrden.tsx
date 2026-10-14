"use client";

import Link from "next/link";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatearCantidadConUnidad } from "@/lib/formato";
import type { ResumenMaterialOrden } from "../contrato-orden";
import { useResumenOrden } from "../useResumenOrden";

const columnas: ColumnaTabla<ResumenMaterialOrden>[] = [
  { id: "material", encabezado: "Material", principal: true, celda: (fila) => <Link className="text-primary underline" href={`/inventario/${fila.material.id}`}>{fila.material.nombre}</Link> },
  ...(["estimado", "consumido", "devuelto", "neto"] as const).map((campo) => ({ id: campo,
    encabezado: { estimado: "Estimado", consumido: "Consumido", devuelto: "Devuelto", neto: "Neto" }[campo],
    alinear: "derecha" as const, celda: (fila: ResumenMaterialOrden) => <span>{formatearCantidadConUnidad(fila[campo], fila.material.unidad)}</span> })),
];
export function MaterialesOrden({ ordenId, consumir }: { ordenId: string; consumir: boolean }) {
  const { resumen, error, recargar } = useResumenOrden(ordenId);
  return <Card className="min-w-0"><CardHeader><CardTitle><h2>Materiales</h2></CardTitle></CardHeader><CardContent className="min-w-0 space-y-4">
    <div aria-live="polite">{error ? <div role="alert"><p>{error}</p><Button type="button" variant="outline" onClick={recargar}>Reintentar</Button></div>
      : !resumen ? <p>Cargando materiales…</p> : null}</div>
    {resumen ? <>
      <DataTable titulo="Materiales de la orden" filas={resumen.materiales} columnas={columnas} idFila={(fila) => fila.material.id}
        className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:px-2 [&_th]:px-2" />
      <div className="flex flex-wrap gap-3">
        {consumir && resumen.admiteConsumo ? <Button asChild><Link href={`/inventario/consumo?ordenId=${ordenId}`}>Registrar consumo</Link></Button> : null}
        {consumir && resumen.admiteDevolucion ? <Button asChild variant="outline"><Link href={`/inventario/devolucion?ordenId=${ordenId}`}>Devolver sobrante</Link></Button> : null}
      </div></> : null}
  </CardContent></Card>;
}
