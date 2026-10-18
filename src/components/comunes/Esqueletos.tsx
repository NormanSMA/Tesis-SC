import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Esqueleto de tarjetas KPI con la misma retícula que el panel. */
export function EsqueletoTarjetas({ cantidad = 4, className }: { cantidad?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: cantidad }, (_, indice) => (
        <div key={indice} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:p-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-5 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de filas operativas (feed). */
export function EsqueletoFilas({ cantidad = 5, className }: { cantidad?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: cantidad }, (_, indice) => (
        <div key={indice} className="flex items-center gap-3 rounded-lg border border-border/80 bg-card p-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1"><Skeleton className="h-3.5 w-32" /><Skeleton className="mt-2 h-3 w-48" /></div>
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de tabla: barra de herramientas, cabecera y filas. */
export function EsqueletoTabla({ filas = 8, columnas = 5, className }: { filas?: number; columnas?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-full sm:w-72" />
        <Skeleton className="h-10 w-96 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex gap-6 border-b border-border bg-muted px-4 py-3">
          {Array.from({ length: columnas }, (_, indice) => <Skeleton key={indice} className="h-3 flex-1" />)}
        </div>
        {Array.from({ length: filas }, (_, fila) => (
          <div key={fila} className="flex h-12 items-center gap-6 border-b border-border-subtle px-4 last:border-0">
            {Array.from({ length: columnas }, (_, indice) => <Skeleton key={indice} className="h-3.5 flex-1" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
