import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ANCHOS = ["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4", "w-5/6"];

type PropiedadesCarga = {
  filas?: number;
  className?: string;
};

export function LoadingState({ filas = 5, className }: PropiedadesCarga) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("space-y-3 rounded-lg border bg-card p-5", className)}
    >
      <span className="sr-only">Cargando información</span>
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: filas }, (_, indice) => (
        <Skeleton key={indice} className={cn("h-10", ANCHOS[indice % ANCHOS.length])} />
      ))}
    </div>
  );
}
