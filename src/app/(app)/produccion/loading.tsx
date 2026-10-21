import { EsqueletoFilas, EsqueletoTarjetas } from "@/components/comunes/Esqueletos";

export default function CargandoProduccion() {
  return <div role="status" className="flex flex-col gap-4">
    <span className="sr-only">Cargando producción</span>
    <EsqueletoTarjetas />
    <EsqueletoFilas cantidad={6} />
  </div>;
}
