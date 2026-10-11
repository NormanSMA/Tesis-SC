import Link from "next/link";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { Fecha, Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";
import type { ConsultaCotizaciones } from "../schema";
import type { CotizacionFila, ListaCotizaciones } from "../tipos";
import { EstadoCotizacion } from "./EstadoCotizacion";

function hrefPagina(consulta: ConsultaCotizaciones, pagina: number) {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries({ ...consulta, pagina })) {
    if (valor !== undefined && valor !== "") parametros.set(campo, String(valor));
  }
  return `/cotizaciones?${parametros}`;
}

const columnas: ColumnaTabla<CotizacionFila>[] = [
  { id: "numero", encabezado: "Número", principal: true, celda: (fila) =>
    <div><Link href={`/cotizaciones/${fila.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{fila.numero}</Link>
      <span className="block text-xs text-muted-foreground">Versión {fila.version}</span></div> },
  { id: "cliente", encabezado: "Cliente", celda: (fila) => <span className="block max-w-48 truncate" title={fila.cliente.nombre}>{fila.cliente.nombre}</span> },
  { id: "estado", encabezado: "Estado", celda: (fila) => <div><EstadoCotizacion estado={fila.estado} />
    {fila.usuarioAprobacion ? <span className="mt-1 block text-xs">{fila.usuarioAprobacion.nombre}</span> : null}
    {fila.referenciaAprobacion ? <span className="block text-xs">{fila.referenciaAprobacion}</span> : null}</div> },
  { id: "total", encabezado: "Total", alinear: "derecha", celda: (fila) => <Money valor={fila.total} /> },
  { id: "asunto", encabezado: "Asunto", celda: (fila) => <span className="block max-w-64 truncate" title={fila.asunto ?? ""}>{fila.asunto ?? "—"}</span> },
  { id: "emision", encabezado: "Emisión", celda: (fila) => <Fecha valor={fila.fechaEmision} /> },
  { id: "vencimiento", encabezado: "Vencimiento", celda: (fila) => <Fecha valor={fila.fechaVencimiento} /> },
];

export function TablaCotizaciones({ lista, consulta, puedeGestionar }: {
  lista: ListaCotizaciones; consulta: ConsultaCotizaciones; puedeGestionar: boolean;
}) {
  const vacio = <EmptyState titulo={lista.total ? "Esa página no existe" : "Sin cotizaciones"}
    descripcion={lista.total ? "Abra la primera página para consultar los resultados." : "Cree una cotización o ajuste los filtros."}
    accion={<div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={hrefPagina(consulta, 1)}>Primera página</Link></Button>
      {puedeGestionar ? <Button asChild><Link href="/cotizaciones/nueva">Nueva cotización</Link></Button> : null}</div>} />;
  return <DataTable titulo="Listado de cotizaciones" columnas={columnas} filas={lista.datos} idFila={(fila) => fila.id}
    className="max-xl:[&_th:nth-child(n+5)]:hidden max-xl:[&_td:nth-child(n+5)]:hidden max-xl:[&_th]:px-2 max-xl:[&_td]:px-2 max-xl:[&_table]:table-fixed max-xl:[&_th:first-child]:w-36 max-xl:[&_th:nth-child(3)]:w-32 max-xl:[&_th:nth-child(4)]:w-36 max-xl:[&_td:nth-child(2)>span]:max-w-full"
    vacio={vacio} paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
      hrefPagina: (pagina) => hrefPagina(consulta, pagina) }} />;
}
