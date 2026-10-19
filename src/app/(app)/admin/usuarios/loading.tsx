import { EsqueletoTabla } from "@/components/comunes/Esqueletos";

export default function CargandoUsuarios() {
  return (
    <div role="status" aria-label="Cargando usuarios" className="min-w-0">
      <span className="sr-only">Cargando usuarios…</span>
      <EsqueletoTabla columnas={4} />
    </div>
  );
}
