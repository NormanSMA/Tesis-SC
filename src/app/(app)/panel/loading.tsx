export default function CargandoPanel() {
  return (
    <section aria-label="Panel" aria-busy="true" className="min-w-0 max-w-full">
      <h1 className="mb-4 text-2xl font-semibold">Panel</h1>
      <p role="status" className="mb-6 text-sm text-muted-foreground">Cargando panel...</p>
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 min-[761px]:grid-cols-2 min-[1101px]:grid-cols-12 motion-safe:animate-pulse">
        {[0, 1, 2, 3].map((indice) => (
          <div key={indice} className="h-36 min-w-0 rounded-2xl bg-muted min-[1101px]:col-span-3" />
        ))}
        <div className="h-80 min-w-0 rounded-2xl bg-muted min-[1101px]:col-span-8" />
        <div className="h-80 min-w-0 rounded-2xl bg-muted min-[1101px]:col-span-4" />
      </div>
    </section>
  );
}
