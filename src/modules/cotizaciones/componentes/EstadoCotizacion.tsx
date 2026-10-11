import { EstadoBadge } from "@/components/comunes/EstadoBadge";

export function EstadoCotizacion({ estado }: { estado: string }) {
  return <EstadoBadge tipo="cotizacion" estado={estado} />;
}
