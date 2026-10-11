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

/** Enlace extendido: toda la fila navega a la ficha. El resto de las celdas es solo texto. */
const ENLACE_FILA = "font-medium text-primary underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] hover:underline";
const columnas: ColumnaTabla<CotizacionFila>[] = [
  { id: "numero", encabezado: "Número", celda: (fila) =>
    <div className="flex flex-wrap items-baseline gap-x-2">
      <Link href={`/cotizaciones/${fila.id}`} className={ENLACE_FILA}>{fila.numero}</Link>
      <span className="text-xs text-muted-foreground"><span aria-hidden="true">v{fila.version}</span><span className="sr-only">Versión {fila.version}</span></span></div> },
  { id: "cliente", encabezado: "Cliente", celda: (fila) => <span className="block max-w-56 truncate max-md:max-w-full" title={fila.cliente.nombre}>{fila.cliente.nombre}</span> },
  { id: "estado", encabezado: "Estado", celda: (fila) => <EstadoCotizacion estado={fila.estado} /> },
  { id: "total", encabezado: "Total", alinear: "derecha", celda: (fila) => <Money valor={fila.total} className="font-medium" /> },
  { id: "vencimiento", encabezado: "Vencimiento", celda: (fila) => <span><span className="text-muted-foreground md:hidden">Vence: </span>
    <Fecha valor={fila.fechaVencimiento} /></span> },
];
/** Escritorio: tabla. Móvil (menos de 768 px): una tarjeta apilada por fila, sin desplazamiento horizontal. */
const CLASES_TABLA = [
  "[&_tbody_tr]:relative [&_tbody_tr]:cursor-pointer [&_tbody_tr:has(a:focus-visible)]:outline-2 [&_tbody_tr:has(a:focus-visible)]:-outline-offset-2 [&_tbody_tr:has(a:focus-visible)]:outline-ring",
  "max-md:[&_thead]:sr-only max-md:[&_tr]:grid max-md:[&_tr]:h-auto max-md:[&_tr]:items-center max-md:[&_tr]:grid-cols-2 max-md:[&_tr]:gap-x-3 max-md:[&_tr]:gap-y-1 max-md:[&_tr]:px-4 max-md:[&_tr]:py-3",
  "max-md:[&_td]:whitespace-normal max-md:[&_td]:p-0 max-md:[&_td]:text-left max-md:[&_th]:whitespace-normal max-md:[&_th]:p-0 max-md:[&_td:nth-child(2)]:col-span-2",
  "max-md:[&_td:nth-child(3)]:col-start-2 max-md:[&_td:nth-child(3)]:row-start-1 max-md:[&_td:nth-child(3)]:justify-self-end",
].join(" ");

export function TablaCotizaciones({ lista, consulta, puedeGestionar }: {
  lista: ListaCotizaciones; consulta: ConsultaCotizaciones; puedeGestionar: boolean;
}) {
  const vacio = <EmptyState ilustracion="marketing-digital" titulo={lista.total ? "Esa página no existe" : "Sin cotizaciones"}
    descripcion={lista.total ? "Abra la primera página para consultar los resultados." : "Cree una cotización o ajuste los filtros."}
    accion={<div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={hrefPagina(consulta, 1)}>Primera página</Link></Button>
      {puedeGestionar ? <Button asChild><Link href="/cotizaciones/nueva">Nueva cotización</Link></Button> : null}</div>} />;
  return <DataTable titulo="Listado de cotizaciones" columnas={columnas} filas={lista.datos} idFila={(fila) => fila.id}
    className={CLASES_TABLA}
    vacio={vacio} paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
      hrefPagina: (pagina) => hrefPagina(consulta, pagina) }} />;
}
