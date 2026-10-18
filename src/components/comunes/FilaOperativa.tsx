import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PuntoEnVivo } from "@/components/comunes/PuntoEnVivo";
import { cn } from "@/lib/utils";

type PropiedadesFila = {
  destino: string;
  icono: LucideIcon;
  codigo: string;
  /** Badge de urgencia o estado, junto al código. */
  insignia?: ReactNode;
  titulo: string;
  detalle?: string;
  /** Valor monetario o cuantitativo; se omite si es null. */
  valor?: string | null;
  /** Alerta de tiempo relativo, ej. "Sin respuesta hace 4 días". */
  tiempo?: string;
  critica?: boolean;
};

/** Fila operativa del feed: icono + código + badge | título + detalle | valor + tiempo + chevron. */
export function FilaOperativa({ destino, icono: Icono, codigo, insignia, titulo, detalle, valor, tiempo, critica }: PropiedadesFila) {
  return (
    <Link href={destino}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border/80 bg-card p-3 transition-colors duration-100 ease-out hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors duration-100 group-hover:bg-slate-200">
        <Icono aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{codigo}</span>
          {insignia}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {titulo}{detalle ? <span className="text-slate-400"> · {detalle}</span> : null}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className="text-right">
          {valor ? <span className="block text-sm font-medium text-slate-900 tabular-nums">{valor}</span> : null}
          {tiempo ? (
            <span className={cn("mt-0.5 flex items-center justify-end gap-1.5 text-[11px]", critica ? "text-danger" : "text-muted-foreground")}>
              {critica ? <PuntoEnVivo /> : null}{tiempo}
            </span>
          ) : null}
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-slate-400 transition-transform duration-100 group-hover:translate-x-0.5 group-hover:text-slate-600" />
      </span>
    </Link>
  );
}
