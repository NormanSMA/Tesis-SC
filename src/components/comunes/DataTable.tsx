import type { ReactNode } from "react";

import { EmptyState } from "@/components/comunes/EmptyState";
import { Paginacion, type PaginacionTabla } from "@/components/comunes/Paginacion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
};

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
}: {
  fila: T;
  columnas: ColumnaTabla<T>[];
  acciones?: (fila: T) => ReactNode;
}) {
  return (
    <TableRow className="h-12">
      {columnas.map((columna) => (
        <TableCell
          key={columna.id}
          className={cn(columna.alinear === "derecha" && "text-right", columna.principal && CELDA_FIJA)}
        >
          {columna.celda(fila)}
        </TableCell>
      ))}
      {acciones ? <TableCell className="text-right">{acciones(fila)}</TableCell> : null}
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
}: PropiedadesTabla<T>) {
  if (filas.length === 0) {
    return vacio ?? <EmptyState titulo="Sin resultados" descripcion="No hay registros que mostrar." />;
  }
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <Table
        containerClassName="max-h-[calc(100dvh-16rem)] min-h-24"
        containerProps={{ role: "region", "aria-label": titulo, tabIndex: 0 }}
      >
        <caption className="sr-only">{titulo}</caption>
        <TableHeader>
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
            <FilaDatos key={idFila(fila)} fila={fila} columnas={columnas} acciones={acciones} />
          ))}
        </TableBody>
      </Table>
      {paginacion ? <Paginacion {...paginacion} /> : null}
    </div>
  );
}
