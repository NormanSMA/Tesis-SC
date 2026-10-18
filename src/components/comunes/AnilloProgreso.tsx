import type { CSSProperties } from "react";

import { porcentajeVisible } from "@/lib/listas/numeros";
import { cn } from "@/lib/utils";

type PropiedadesAnillo = {
  /** Valor actual en la misma unidad que total (ej. 64 de 100). */
  valor: number;
  total?: number;
  /** Meta opcional: marca un trazo fino en esa posición. */
  meta?: number;
  radio?: number;
  grosor?: number;
  /** Texto central; por defecto el porcentaje real redondeado (puede pasar de 100). */
  centro?: string;
  subtexto?: string;
  etiqueta: string;
  tono?: "primario" | "exito" | "advertencia" | "peligro";
  className?: string;
};

const TONOS = { primario: "stroke-primary", exito: "stroke-success", advertencia: "stroke-warning", peligro: "stroke-danger" };

/** Anillo SVG de avance. Se dibuja con stroke-dashoffset (solo pinta, sin reflujo) en 500 ms. */
export function AnilloProgreso({ valor, total = 100, meta, radio = 34, grosor = 6, centro, subtexto, etiqueta, tono = "primario", className }: PropiedadesAnillo) {
  const lado = (radio + grosor) * 2;
  const circunferencia = 2 * Math.PI * radio;
  const visible = porcentajeVisible(valor, total);
  const desplazamiento = circunferencia * (1 - visible / 100);
  const real = total > 0 && Number.isFinite(valor) ? Math.round((valor / total) * 100) : 0;
  const angulo = meta !== undefined ? (porcentajeVisible(meta, total) / 100) * 360 : null;
  return (
    <div role="img" aria-label={`${etiqueta}: ${real} %${meta !== undefined ? `, meta ${Math.round(porcentajeVisible(meta, total))} %` : ""}`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`} className="-rotate-90" aria-hidden="true">
        <circle cx={lado / 2} cy={lado / 2} r={radio} fill="none" strokeWidth={grosor} className="stroke-slate-100" />
        <circle cx={lado / 2} cy={lado / 2} r={radio} fill="none" strokeWidth={grosor} strokeLinecap="round"
          className={cn(TONOS[tono], visible > 0 && "animate-ring-fill")}
          strokeDasharray={circunferencia} strokeDashoffset={visible > 0 ? desplazamiento : circunferencia}
          style={{ "--anillo-inicio": circunferencia } as CSSProperties} />
        {angulo !== null ? (
          <line x1={lado - grosor * 1.5} y1={lado / 2} x2={lado} y2={lado / 2} strokeWidth={2} className="stroke-slate-400"
            transform={`rotate(${angulo} ${lado / 2} ${lado / 2})`} />
        ) : null}
      </svg>
      <span aria-hidden="true" className="absolute flex flex-col items-center text-center leading-tight">
        <span className="text-sm font-bold text-foreground tabular-nums">{centro ?? `${real} %`}</span>
        {subtexto ? <span className="text-[10px] font-medium text-muted-foreground">{subtexto}</span> : null}
      </span>
    </div>
  );
}
