import { EsqueletoFilas, EsqueletoTarjetas } from "@/components/comunes/Esqueletos";

export default function CargandoPanel() {
  return (
    <section aria-label="Panel" aria-busy="true" className="min-w-0 max-w-full">
      <h1 className="mb-2 text-xl font-semibold sm:text-2xl">Panel</h1>
      <p role="status" className="mb-5 text-xs text-muted-foreground">Cargando panel...</p>
      <EsqueletoTarjetas />
      <div aria-hidden="true" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-8 lg:p-5">
          <EsqueletoFilas className="overflow-hidden" />
        </div>
        <div className="min-w-0 rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-4 lg:p-5">
          <EsqueletoFilas cantidad={1} className="overflow-hidden" />
          <div className="mt-5 h-52 rounded-lg bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
    </section>
  );
}
