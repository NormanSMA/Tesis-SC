import Link from "next/link";
import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { BarraProgresoAnimada } from "@/components/comunes/BarraProgresoAnimada";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { PuntoEnVivo } from "@/components/comunes/PuntoEnVivo";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { Button } from "@/components/ui/button";
import type { Orden } from "@/lib/listas/orden";
import { tiempoRelativo } from "@/lib/listas/tiempo-relativo";
import type { CampoOrdenOrdenes, ListaOrdenes, OrdenFila } from "../tipos";

function hrefPagina(parametros: Record<string, string>, pagina: number) {
  return `/ordenes?${new URLSearchParams({ ...parametros, pagina: String(pagina) })}`;
}

/** La entrega es una fecha de calendario: vence al final de ese día en Managua (UTC-6, sin horario de verano). */
function finDeDia(fecha: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T23:59:59-06:00` : fecha;
}

/** Enlace extendido: toda la fila navega a la ficha. El resto de las celdas es solo texto. */
const ENLACE_FILA = "font-medium text-primary underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] hover:underline";

function columnasDe(referencia: string): ColumnaTabla<OrdenFila>[] {
  return [
    { id: "numero", encabezado: "Orden", ordenable: "numero", celda: (fila) => <div className="min-w-0">
      <Link href={`/ordenes/${fila.id}`} className={ENLACE_FILA}>{fila.numero}</Link>
      {fila.cotizacion.asunto ? <p className="truncate text-xs text-muted-foreground" title={fila.cotizacion.asunto}>{fila.cotizacion.asunto}</p> : null}
    </div> },
    { id: "cliente", encabezado: "Cliente", ordenable: "cliente", celda: (fila) => <div className="min-w-0">
      <span className="block truncate" title={fila.cliente.nombre}>{fila.cliente.nombre}</span>
      <span className="block truncate text-xs text-muted-foreground">{fila.cliente.codigoCliente}</span>
    </div> },
    { id: "estado", encabezado: "Estado", celda: (fila) => <EstadoBadge tipo="orden" estado={fila.estado} /> },
    { id: "avance", encabezado: "Avance", celda: (fila) => fila.avance && fila.avance.total > 0
      ? <BarraProgresoAnimada valor={fila.avance.completadas} total={fila.avance.total} etiqueta="Etapas completadas"
        texto={`${fila.avance.completadas} de ${fila.avance.total}`} className="md:max-lg:flex-col md:max-lg:items-stretch md:max-lg:gap-0.5" />
      : <span aria-label="Sin etapas" className="text-muted-foreground">—</span> },
    { id: "entrega", encabezado: "Entrega", ordenable: "fechaEntrega", celda: (fila) => <div className="min-w-0">
      <span><span className="text-muted-foreground md:hidden">Entrega: </span><Fecha valor={fila.fechaEntrega} /></span>
      <span className={fila.atrasada ? "flex items-center gap-1.5 truncate text-xs font-semibold text-danger" : "block truncate text-xs text-muted-foreground"}>
        {fila.atrasada ? <><PuntoEnVivo className="shrink-0" /><span className="sr-only">Atrasada: </span></> : null}
        {tiempoRelativo(finDeDia(fila.fechaEntrega), referencia)}
      </span>
    </div> },
    { id: "responsable", encabezado: "Responsable", celda: (fila) => fila.responsable
      ? <div className="flex min-w-0 items-center gap-2">
        <AvatarIniciales nombre={fila.responsable.nombre} className="size-7 md:max-lg:hidden" />
        <span className="truncate" title={fila.responsable.nombre}>{fila.responsable.nombre}</span>
      </div>
      : <span className="text-amber-700">Sin responsable</span> },
    { id: "creadoEn", encabezado: "Creada", ordenable: "creadoEn", celda: (fila) => <Fecha valor={fila.creadoEn} /> },
  ];
}

/**
 * Escritorio: tabla de ancho fijo con porcentajes, así cabe a 768 px sin desplazamiento (la columna Creada solo desde 2xl).
 * Móvil (menos de 768 px): una tarjeta apilada por fila.
 */
const CLASES_TABLA = [
  "[&_tbody_tr]:relative [&_tbody_tr]:cursor-pointer [&_tbody_tr:has(a:focus-visible)]:outline-2 [&_tbody_tr:has(a:focus-visible)]:-outline-offset-2 [&_tbody_tr:has(a:focus-visible)]:outline-ring",
  "md:[&_table]:table-fixed md:[&_th]:px-2 md:[&_td]:px-2 lg:[&_th]:px-4 lg:[&_td]:px-4",
  "md:[&_th:nth-child(1)]:w-[18%] md:[&_th:nth-child(2)]:w-[17%] md:[&_th:nth-child(3)]:w-[19%] md:[&_th:nth-child(4)]:w-[13%] md:[&_th:nth-child(5)]:w-[15%] md:[&_th:nth-child(6)]:w-[18%]",
  "2xl:[&_th:nth-child(1)]:w-[16%] 2xl:[&_th:nth-child(2)]:w-[15%] 2xl:[&_th:nth-child(3)]:w-[16%] 2xl:[&_th:nth-child(4)]:w-[12%] 2xl:[&_th:nth-child(5)]:w-[13%] 2xl:[&_th:nth-child(6)]:w-[16%] 2xl:[&_th:nth-child(7)]:w-[12%]",
  "max-2xl:[&_th:nth-child(7)]:hidden max-2xl:[&_td:nth-child(7)]:hidden",
  "max-md:[&_thead]:sr-only max-md:[&_tr]:grid max-md:[&_tr]:h-auto max-md:[&_tr]:items-center max-md:[&_tr]:grid-cols-2 max-md:[&_tr]:gap-x-3 max-md:[&_tr]:gap-y-1 max-md:[&_tr]:px-4 max-md:[&_tr]:py-3",
  "max-md:[&_td]:whitespace-normal max-md:[&_td]:p-0 max-md:[&_td]:text-left max-md:[&_th]:whitespace-normal max-md:[&_th]:p-0",
  "max-md:[&_td:nth-child(2)]:col-span-2 max-md:[&_td:nth-child(4)]:col-span-2",
  "max-md:[&_td:nth-child(3)]:col-start-2 max-md:[&_td:nth-child(3)]:row-start-1 max-md:[&_td:nth-child(3)]:justify-self-end",
].join(" ");

export function TablaOrdenes({ lista, parametros, orden, referencia }: {
  lista: ListaOrdenes; parametros: Record<string, string>; orden: Orden<CampoOrdenOrdenes> | null; referencia: string;
}) {
  const filtrado = ["q", "vista", "responsable", "cliente"].some((clave) => clave in parametros);
  const vacio = lista.total > 0
    ? <EmptyState ilustracion="rotulacion" titulo="Esa página no existe"
      descripcion={`La consulta tiene ${lista.total} resultados en menos páginas.`}
      accion={<Button asChild variant="outline"><Link href={hrefPagina(parametros, 1)}>Ir a la primera página</Link></Button>} />
    : <EmptyState ilustracion="rotulacion" titulo={filtrado ? "Sin resultados" : "Sin órdenes"}
      descripcion={filtrado ? "Ninguna orden coincide con la consulta. Pruebe otros términos o quite los filtros."
        : "Convierta una cotización aprobada para crear la primera orden."}
      accion={filtrado ? <Button asChild variant="outline"><Link href="/ordenes">Limpiar filtros</Link></Button> : undefined} />;
  return <ZonaResultados>
    <DataTable titulo="Listado de órdenes de trabajo" columnas={columnasDe(referencia)} filas={lista.datos} idFila={(fila) => fila.id}
      className={CLASES_TABLA} orden={orden} claveConsulta={new URLSearchParams(parametros).toString()}
      vacio={vacio} paginacion={{ pagina: lista.pagina, total: lista.total, tamano: lista.porPagina,
        hrefPagina: (pagina) => hrefPagina(parametros, pagina) }} />
  </ZonaResultados>;
}
