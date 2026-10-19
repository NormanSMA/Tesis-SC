import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PuntoEnVivo } from "@/components/comunes/PuntoEnVivo";
import { cn } from "@/lib/utils";

export type TonoMiniatura = "primario" | "info" | "advertencia" | "exito" | "neutro";

const MINIATURAS: Record<TonoMiniatura, string> = {
  primario: "bg-indigo-50 text-primary ring-indigo-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
  advertencia: "bg-amber-50 text-amber-700 ring-amber-100",
  exito: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  neutro: "bg-slate-100 text-slate-600 ring-slate-200",
};

/** Columnas compartidas por la cabecera y las filas del feed (desde 1024 px; debajo, dos líneas). */
export const COLUMNAS_FEED = "lg:grid-cols-[minmax(0,1fr)_8.5rem_7rem_7.5rem_1rem]";

type PropiedadesFila = {
  destino: string;
  icono: LucideIcon;
  tono?: TonoMiniatura;
  /** Título principal (cliente, material o etapa). */
  titulo: string;
  /** Código del documento y detalle en una línea gris. */
  codigo: string;
  detalle?: string;
  /** Insignia de urgencia o estado. */
  insignia?: ReactNode;
  /** Valor monetario o cuantitativo; se omite si es null. */
  valor?: string | null;
  /** Alerta de tiempo relativo, ej. "Sin respuesta hace 4 días". */
  tiempo?: string;
  critica?: boolean;
};

/** Fila del feed estilo Mise: miniatura + título y código | insignia | valor | tiempo | chevron. */
export function FilaOperativa({ destino, icono: Icono, tono = "neutro", titulo, codigo, detalle, insignia, valor, tiempo, critica }: PropiedadesFila) {
  return (
    <Link href={destino}
      className={cn("group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 transition-colors duration-100 ease-out hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-ring lg:grid-cols-none lg:gap-y-0", COLUMNAS_FEED)}>
      <span className="flex min-w-0 items-center gap-4 max-lg:contents">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl ring-1", MINIATURAS[tono])}>
          <Icono aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-slate-900">{titulo}</span>
          <span className="mt-0.5 block truncate text-sm text-slate-500">{codigo}{detalle ? ` · ${detalle}` : ""}</span>
        </span>
      </span>
      <span className="max-lg:col-start-2 max-lg:flex max-lg:flex-wrap max-lg:items-center max-lg:gap-x-3 max-lg:gap-y-1 lg:contents">
        <span className="flex">{insignia}</span>
        <span className="text-[15px] font-semibold text-slate-900 tabular-nums">{valor ?? <span className="text-slate-400 lg:block" aria-hidden="true">—</span>}</span>
        <span className={cn("flex items-center gap-1.5 text-sm", critica ? "font-medium text-danger" : "text-slate-600")}>
          {critica ? <PuntoEnVivo /> : null}{tiempo}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="hidden size-4 text-slate-400 transition-transform duration-100 group-hover:translate-x-0.5 group-hover:text-slate-600 lg:block" />
    </Link>
  );
}

/** Insignia blanca con punto de color (prioridad o urgencia), como la de Mise. */
export function InsigniaPunto({ tono, children }: { tono: "peligro" | "advertencia" | "info" | "exito" | "neutro"; children: ReactNode }) {
  const punto = { peligro: "bg-danger", advertencia: "bg-warning", info: "bg-info", exito: "bg-success", neutro: "bg-slate-400" }[tono];
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-card px-2 text-xs font-medium whitespace-nowrap text-slate-700 shadow-xs">
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", punto)} />{children}
    </span>
  );
}
