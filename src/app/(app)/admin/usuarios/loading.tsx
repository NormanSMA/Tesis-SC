import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoUsuarios() {
  return (
    <div role="status" aria-label="Cargando usuarios" className="min-w-0 space-y-5">
      <span className="sr-only">Cargando usuarios…</span>
      <Skeleton className="h-8 w-2/3" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" />
    </div>
  );
}
