import { cn } from "@/lib/utils";

const TONOS = { peligro: "bg-danger", advertencia: "bg-warning", info: "bg-info", exito: "bg-success" };

/**
 * Punto de 6 px con pulso (ping). Solo para estados críticos o en curso, nunca decorativo.
 * Con movimiento reducido el pulso se detiene y queda el punto fijo.
 */
export function PuntoEnVivo({ tono = "peligro", pulso = true, className }: { tono?: keyof typeof TONOS; pulso?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-1.5 shrink-0", className)}>
      {pulso ? <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", TONOS[tono])} /> : null}
      <span className={cn("relative inline-flex size-1.5 rounded-full", TONOS[tono])} />
    </span>
  );
}
