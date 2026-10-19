import { EsqueletoTabla } from "@/components/comunes/Esqueletos";

export default function CargandoClientes() {
  return <div role="status">
    <span className="sr-only">Cargando clientes</span>
    <EsqueletoTabla filas={8} columnas={4} />
  </div>;
}
