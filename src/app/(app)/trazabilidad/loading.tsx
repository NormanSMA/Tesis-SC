import { EsqueletoTabla } from "@/components/comunes/Esqueletos";

export default function CargandoTrazabilidad() {
  return (
    <div role="status" aria-label="Cargando trazabilidad" className="min-w-0">
      <span className="sr-only">Cargando trazabilidad…</span>
      <EsqueletoTabla columnas={4} />
    </div>
  );
}
