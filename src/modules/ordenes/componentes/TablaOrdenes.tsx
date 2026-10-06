import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import type { ConsultaOrdenes } from "../schema";
import type { ListaOrdenes, OrdenFila } from "../tipos";

const columnas: ColumnaTabla<OrdenFila>[] = [
  { id: "numero", encabezado: "Número", principal: true, celda: (fila) => <div className="space-y-1">
    <Link href={`/ordenes/${fila.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{fila.numero}</Link>
    <span className="block text-xs text-muted-foreground xl:hidden">{fila.categoria.nombre}</span></div> },
  { id: "cliente", encabezado: "Cliente", celda: (fila) => <div className="space-y-1"><span>{fila.cliente.nombre}</span>
    <span className="block text-xs text-muted-foreground xl:hidden">Responsable: {fila.responsable.nombre}</span></div> },
  { id: "categoria", encabezado: "Categoría", celda: (fila) => fila.categoria.nombre },
  { id: "estado", encabezado: "Estado", celda: (fila) => <EstadoBadge tipo="orden" estado={fila.estado} /> },
  { id: "responsable", encabezado: "Responsable", celda: (fila) => fila.responsable.nombre },
  { id: "entrega", encabezado: "Entrega", celda: (fila) => <div className="space-y-1"><Fecha valor={fila.fechaEntrega} />
    {fila.atrasada ? <span className="flex items-center gap-1 text-xs font-semibold text-danger"><TriangleAlert aria-hidden="true" className="size-4" />Atrasada</span> : null}</div> },
];

function hrefPagina(consulta: ConsultaOrdenes, pagina: number) {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries({ ...consulta, pagina })) {
    if (valor !== undefined && valor !== "") parametros.set(campo, String(valor));
  }
  return `/ordenes?${parametros}`;
}

export function TablaOrdenes({ lista, consulta }: { lista: ListaOrdenes; consulta: ConsultaOrdenes }) {
  return <DataTable titulo="Listado de órdenes de trabajo" columnas={columnas} filas={lista.datos} idFila={(fila) => fila.id}
    className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_th]:px-2 [&_td]:px-2 [&_th:first-child]:w-32 max-xl:[&_th:nth-child(3)]:hidden max-xl:[&_td:nth-child(3)]:hidden max-xl:[&_th:nth-child(5)]:hidden max-xl:[&_td:nth-child(5)]:hidden"
    vacio={<EmptyState titulo="Sin órdenes" descripcion="Ajuste los filtros o convierta una cotización aprobada." />}
    paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
      hrefPagina: (pagina) => hrefPagina(consulta, pagina) }} />;
}
