import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { cn } from "@/lib/utils";

export function Money({ valor, className }: { valor: string | number | null | undefined; className?: string }) {
  const texto = formatearMoneda(valor);
  return <span className={cn("tabular-nums", className)}>{texto || "—"}</span>;
}

/** Acepta AAAA-MM-DD o un instante ISO 8601. */
export function Fecha({ valor, className }: { valor: string | null | undefined; className?: string }) {
  const texto = formatearFecha(valor);
  if (!texto || !valor) return <span className={className}>—</span>;
  return (
    <time dateTime={valor} className={cn("tabular-nums", className)}>
      {texto}
    </time>
  );
}
