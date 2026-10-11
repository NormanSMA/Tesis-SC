import type { ReactNode } from "react";

import { EmptyState } from "@/components/comunes/EmptyState";
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
};

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
};

const FILA_APILADA = "max-md:grid max-md:h-auto max-md:grid-cols-1 max-md:gap-y-1 max-md:border-b max-md:px-4 max-md:py-3";
const CELDA_APILADA =
  "max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:p-0 max-md:text-left max-md:whitespace-normal max-md:before:shrink-0 max-md:before:text-xs max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-etiqueta)]";

const CELDA_FIJA = "sticky left-0 z-10 bg-card group-hover/fila:bg-background";

function EncabezadoColumna<T>({ columna }: { columna: ColumnaTabla<T> }) {
  return (
    <TableHead
      scope="col"
      className={cn(columna.alinear === "derecha" && "text-right", columna.principal && "left-0 z-30 bg-muted")}
    >
      {columna.encabezado}
    </TableHead>
  );
}

function FilaDatos<T>({
  fila,
  columnas,
  acciones,
  apilar,
}: {
  fila: T;
  columnas: ColumnaTabla<T>[];
  acciones?: (fila: T) => ReactNode;
  apilar: boolean;
}) {
  return (
    <TableRow className={cn("h-12", apilar && FILA_APILADA)}>
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
}: PropiedadesTabla<T>) {
  if (filas.length === 0) {
    return vacio ?? <EmptyState titulo="Sin resultados" descripcion="No hay registros que mostrar." />;
  }
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <Table
        containerClassName="min-h-24 md:max-h-[calc(100dvh-16rem)]"
        containerProps={{ role: "region", "aria-label": titulo, tabIndex: 0 }}
      >
        <caption className="sr-only">{titulo}</caption>
        <TableHeader className={apilarEnMovil ? "max-md:sr-only" : undefined}>
          <TableRow className="hover:bg-transparent">
            {columnas.map((columna) => (
              <EncabezadoColumna key={columna.id} columna={columna} />
            ))}
            {acciones ? (
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Acciones</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <FilaDatos key={idFila(fila)} fila={fila} columnas={columnas} acciones={acciones} apilar={apilarEnMovil} />
          ))}
        </TableBody>
      </Table>
      {paginacion ? <Paginacion {...paginacion} /> : null}
    </div>
  );
}
