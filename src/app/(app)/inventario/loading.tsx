import { EsqueletoTabla } from "@/components/comunes/Esqueletos";

export default function CargandoInventario() {
  return <div role="status">
    <span className="sr-only">Cargando inventario</span>
    <EsqueletoTabla filas={6} columnas={3} />
  </div>;
}
