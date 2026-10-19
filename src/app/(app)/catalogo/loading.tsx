import { Skeleton } from "@/components/ui/skeleton";

export default function CargandoCatalogo() {
  return <div role="status" aria-busy="true">
    <span className="sr-only">Cargando catálogo</span>
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-full sm:w-72" />
        <Skeleton className="h-10 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, indice) => (
          <div key={indice} className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="size-14 rounded-xl" />
              <div className="flex-1"><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-3 w-16" /></div>
            </div>
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>
    </div>
  </div>;
}
