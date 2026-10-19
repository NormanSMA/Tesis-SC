import { EsqueletoTabla } from "@/components/comunes/Esqueletos";

export default function CargandoCotizaciones() {
  return <div role="status">
    <span className="sr-only">Cargando cotizaciones</span>
    <EsqueletoTabla filas={8} columnas={6} />
  </div>;
}
