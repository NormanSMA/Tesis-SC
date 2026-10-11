import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { IconoServicio } from "@/components/comunes/IconoServicio";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import type { ConsultaOrdenes } from "../schema";
import type { ListaOrdenes, OrdenFila } from "../tipos";

const columnas: ColumnaTabla<OrdenFila>[] = [
  { id: "numero", encabezado: "Número", celda: (fila) => <span className="flex min-w-0 items-center gap-2">
    <IconoServicio categoria={fila.categoria.nombre} tamano={20} decorativo />
    <Link href={`/ordenes/${fila.id}`}
      className="min-w-0 font-semibold text-foreground underline-offset-4 after:absolute after:inset-0 hover:underline">{fila.numero}</Link></span> },
  { id: "cliente", encabezado: "Cliente", celda: (fila) => <div>
    <span>{fila.cliente.nombre}</span>
    <span className="block text-xs text-muted-foreground">{fila.cliente.codigoCliente}</span></div> },
  { id: "estado", encabezado: "Estado", celda: (fila) => <EstadoBadge tipo="orden" estado={fila.estado} /> },
  { id: "entrega", encabezado: "Entrega", celda: (fila) => <div className="space-y-1">
    <span><span className="md:sr-only">Entrega: </span><Fecha valor={fila.fechaEntrega} /></span>
    {fila.atrasada ? <span className="flex items-center gap-1 text-xs font-semibold text-danger"><TriangleAlert aria-hidden="true" className="size-4" />Atrasada</span> : null}</div> },
  { id: "responsable", encabezado: "Responsable", celda: (fila) => <span>
    <span className="md:sr-only">Responsable: </span>{fila.responsable?.nombre ?? "Sin responsable"}</span> },
];

// Escritorio: tabla de 5 columnas. Móvil: cada fila se apila como tarjeta. La fila completa enlaza a la ficha.
const CLASE_TABLA = [
  "min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere] [&_th]:px-2 [&_td]:px-2",
  "[&_tbody_tr]:relative [&_tbody_tr]:cursor-pointer [&_tbody_tr:hover]:bg-muted/60 [&_tbody_tr:focus-within]:outline-2 [&_tbody_tr:focus-within]:-outline-offset-2 [&_tbody_tr:focus-within]:outline-ring",
  "max-md:[&_thead]:sr-only max-md:[&_table]:block max-md:[&_tbody]:block max-md:[&_tbody_tr]:block max-md:[&_tbody_tr]:h-auto max-md:[&_tbody_tr]:min-h-10 max-md:[&_tbody_tr]:px-1 max-md:[&_tbody_tr]:py-2",
  "max-md:[&_td]:block max-md:[&_td]:py-1",
].join(" ");

function hrefPagina(consulta: ConsultaOrdenes, pagina: number) {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries({ ...consulta, pagina })) {
    if (valor !== undefined && valor !== "") parametros.set(campo, String(valor));
  }
  return `/ordenes?${parametros}`;
}

export function TablaOrdenes({ lista, consulta }: { lista: ListaOrdenes; consulta: ConsultaOrdenes }) {
  return <DataTable titulo="Listado de órdenes de trabajo" columnas={columnas} filas={lista.datos} idFila={(fila) => fila.id}
    className={CLASE_TABLA}
    vacio={<EmptyState ilustracion="rotulacion" titulo="Sin órdenes" descripcion="Ajuste los filtros o convierta una cotización aprobada." />}
    paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
      hrefPagina: (pagina) => hrefPagina(consulta, pagina) }} />;
}
