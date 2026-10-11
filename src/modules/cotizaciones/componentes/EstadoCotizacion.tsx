import { EstadoBadge } from "@/components/comunes/EstadoBadge";

export function EstadoCotizacion({ estado }: { estado: string }) {
  return estado === "AJUSTE_SOLICITADO" ?
    <span className="inline-flex rounded-md border px-2 py-0.5 text-xs font-medium">Ajustes solicitados</span> :
    <EstadoBadge tipo="cotizacion" estado={estado} />;
}
