import { EsqueletoTabla, EsqueletoTarjetas } from "@/components/comunes/Esqueletos";

export default function CargandoReportes() {
  return (
    <div role="status" aria-live="polite" className="min-w-0 space-y-4">
      <span className="sr-only">Cargando reporte…</span>
      <EsqueletoTarjetas cantidad={3} className="lg:grid-cols-3" />
      <EsqueletoTabla columnas={4} />
    </div>
  );
}
