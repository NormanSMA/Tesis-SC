import { EsqueletoTabla } from "@/components/comunes/Esqueletos";

export default function CargandoOrdenes() {
  return <div role="status">
    <span className="sr-only">Cargando órdenes</span>
    <EsqueletoTabla filas={8} columnas={6} />
  </div>;
}
