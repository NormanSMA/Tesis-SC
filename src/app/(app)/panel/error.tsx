"use client";

export default function ErrorPanel({ retry }: { retry: () => void }) {
  return (
    <section aria-label="Panel" className="min-w-0 max-w-full">
      <h1 className="mb-4 text-2xl font-semibold">Panel</h1>
      <p role="alert" className="mb-4 text-sm text-danger">No se pudo cargar el panel.</p>
      <button
        type="button"
        onClick={retry}
        className="min-h-10 rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Reintentar
      </button>
    </section>
  );
}
