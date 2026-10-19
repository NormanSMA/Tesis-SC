import { cn } from "@/lib/utils";

const TONOS = { peligro: "bg-danger", advertencia: "bg-warning", info: "bg-info", exito: "bg-success" };

/**
 * Punto de 6 px con pulso (ping). Solo para estados críticos o en curso, nunca decorativo.
 * El pulso y el punto ocupan la misma caja (size-full): el anillo crece desde el centro exacto,
 * aunque className cambie el tamaño. Con movimiento reducido el pulso se detiene.
 */
export function PuntoEnVivo({ tono = "peligro", pulso = true, className }: { tono?: keyof typeof TONOS; pulso?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-1.5 shrink-0", className)}>
      {pulso ? <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", TONOS[tono])} /> : null}
      <span className={cn("relative size-full rounded-full", TONOS[tono])} />
    </span>
  );
}
