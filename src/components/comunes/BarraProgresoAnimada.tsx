import { porcentajeVisible } from "@/lib/listas/numeros";
import { cn } from "@/lib/utils";

type PropiedadesBarra = {
  valor: number;
  total: number;
  /** Nombre accesible, ej. "Etapas completadas". */
  etiqueta: string;
  /** Texto visible a la derecha, ej. "3 de 5". */
  texto?: string;
  tono?: "primario" | "exito" | "advertencia" | "peligro";
  className?: string;
};

const TONOS = { primario: "bg-primary", exito: "bg-success", advertencia: "bg-warning", peligro: "bg-danger" };

/** Barra horizontal de avance o de medida (role meter: es un dato, no una carga). Crece con scaleX desde la izquierda (350 ms); el ancho final es estático. */
export function BarraProgresoAnimada({ valor, total, etiqueta, texto, tono = "primario", className }: PropiedadesBarra) {
  const visible = porcentajeVisible(valor, total);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div role="meter" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={Math.max(total, 0)}
        aria-valuenow={Math.max(Math.min(valor, total), 0)} aria-valuetext={texto}
        className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-100">
        {visible > 0 ? (
          <div className={cn("h-full rounded-full animate-bar-grow-x", TONOS[tono])} style={{ width: `${visible}%` }} />
        ) : null}
      </div>
      {texto ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{texto}</span> : null}
    </div>
  );
}
