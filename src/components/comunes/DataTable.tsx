import type { ReactNode } from "react";

import { CabeceraOrdenable } from "@/components/comunes/CabeceraOrdenable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { MAXIMO_ESCALONADO, retrasoEscalonado } from "@/components/comunes/ListaEscalonada";
import type { DireccionOrden } from "@/lib/listas/orden";
import { Paginacion, type PaginacionTabla } from "@/components/comunes/Paginacion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ColumnaTabla<T> = {
  id: string;
  encabezado: string;
  celda: (fila: T) => ReactNode;
  alinear?: "derecha";
  /** Solo la primera columna: queda fija al desplazar horizontalmente. */
  principal?: boolean;
  /** Campo de la lista blanca de orden del módulo; vuelve interactiva la cabecera. */
  ordenable?: string;
};

/** Orden activo leído de la URL por la página (server). */
export type OrdenTabla = { campo: string; direccion: DireccionOrden } | null;

type PropiedadesTabla<T> = {
  /** Nombre accesible de la tabla. Se publica como caption oculto y como nombre de la región. */
  titulo: string;
  columnas: ColumnaTabla<T>[];
  filas: T[];
  idFila: (fila: T) => string;
  acciones?: (fila: T) => ReactNode;
  vacio?: ReactNode;
  paginacion?: PaginacionTabla;
  className?: string;
  /** En pantallas menores de 768 px cada fila se muestra como tarjeta con la etiqueta de cada columna. */
  apilarEnMovil?: boolean;
  orden?: OrdenTabla;
  /** Cambia con la consulta (búsqueda, filtro, página): las filas vuelven a entrar escalonadas. */
  claveConsulta?: string;
};

const FILA_APILADA = "max-md:grid max-md:h-auto max-md:grid-cols-1 max-md:gap-y-1 max-md:border-b max-md:px-4 max-md:py-3";
const CELDA_APILADA =
  "max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:p-0 max-md:text-left max-md:whitespace-normal max-md:before:shrink-0 max-md:before:text-xs max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-etiqueta)]";

const CELDA_FIJA = "sticky left-0 z-10 bg-card group-hover/fila:bg-slate-50";

function EncabezadoColumna<T>({ columna, orden }: { columna: ColumnaTabla<T>; orden?: OrdenTabla }) {
  const activa = columna.ordenable && orden?.campo === columna.ordenable ? orden.direccion : null;
  return (
    <TableHead
      scope="col"
      aria-sort={columna.ordenable ? (activa === "asc" ? "ascending" : activa === "desc" ? "descending" : "none") : undefined}
      className={cn(columna.alinear === "derecha" && "text-right", columna.principal && "left-0 z-30 bg-slate-50")}
    >
      {columna.ordenable ? (
        <CabeceraOrdenable campo={columna.ordenable} etiqueta={columna.encabezado} activa={activa} alinearDerecha={columna.alinear === "derecha"} />
      ) : columna.encabezado}
    </TableHead>
  );
}

function FilaDatos<T>({
  fila,
  columnas,
  acciones,
  apilar,
  indice,
}: {
  fila: T;
  columnas: ColumnaTabla<T>[];
  acciones?: (fila: T) => ReactNode;
  apilar: boolean;
  indice: number;
}) {
  return (
    <TableRow className={cn("h-12", indice < MAXIMO_ESCALONADO && "animate-row-enter", apilar && FILA_APILADA)}
      style={{ animationDelay: retrasoEscalonado(indice) }}>
      {columnas.map((columna, indice) => {
        const Celda = indice === 0 ? TableRowHeader : TableCell;
        return (
        <Celda
          key={columna.id}
          data-etiqueta={apilar ? columna.encabezado : undefined}
          className={cn(
            columna.alinear === "derecha" && "text-right",
            columna.principal && CELDA_FIJA,
            apilar && cn(CELDA_APILADA, columna.principal && "max-md:static"),
          )}
        >
          {columna.celda(fila)}
        </Celda>
        );
      })}
      {acciones ? <TableCell className={cn("text-right", apilar && "max-md:p-0 max-md:text-left")}>{acciones(fila)}</TableCell> : null}
    </TableRow>
  );
}

export function DataTable<T>({
  titulo,
  columnas,
  filas,
  idFila,
  acciones,
  vacio,
  paginacion,
  className,
  apilarEnMovil = false,
  orden,
  claveConsulta,
}: PropiedadesTabla<T>) {
  if (filas.length === 0) {
    return vacio ?? <EmptyState titulo="Sin resultados" descripcion="No hay registros que mostrar." />;
  }
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm", className)}>
      <Table
        // Sin altura máxima: la lista usa el scroll de la página y no corta filas (como Mise).
        containerClassName="min-h-24"
        containerProps={{ role: "region", "aria-label": titulo, tabIndex: 0 }}
      >
        <caption className="sr-only">{titulo}</caption>
        <TableHeader className={apilarEnMovil ? "max-md:sr-only" : undefined}>
          <TableRow className="hover:bg-transparent">
            {columnas.map((columna) => (
              <EncabezadoColumna key={columna.id} columna={columna} orden={orden} />
            ))}
            {acciones ? (
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody key={claveConsulta}>
          {filas.map((fila, indice) => (
            <FilaDatos key={idFila(fila)} fila={fila} columnas={columnas} acciones={acciones} apilar={apilarEnMovil} indice={indice} />
          ))}
        </TableBody>
      </Table>
      {paginacion ? <Paginacion {...paginacion} /> : null}
    </div>
  );
}
