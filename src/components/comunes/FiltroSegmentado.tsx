"use client";

import { ToggleGroup } from "radix-ui";

import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { cn } from "@/lib/utils";

export type OpcionSegmento = { valor: string; etiqueta: string; conteo?: number };

type PropiedadesFiltro = {
  etiqueta: string;
  opciones: OpcionSegmento[];
  parametro: string;
  /** Valor que significa "sin filtro"; no se escribe en la URL. */
  valorTodos?: string;
  className?: string;
};

/** Pastillas de filtro rápido (segmented control). El valor vive en la URL y vuelve a la página 1. */
export function FiltroSegmentado({ etiqueta, opciones, parametro, valorTodos = "", className }: PropiedadesFiltro) {
  const { parametros, navegar } = useParametrosUrl();
  const actual = parametros.get(parametro) ?? valorTodos;
  return (
    <ToggleGroup.Root type="single" value={actual} aria-label={etiqueta}
      onValueChange={(valor) => { if (valor !== "" && valor !== actual) navegar({ [parametro]: valor === valorTodos ? null : valor }); }}
      className={cn("inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border/80 bg-slate-100/70 p-1", className)}>
      {opciones.map((opcion) => (
        <ToggleGroup.Item key={opcion.valor} value={opcion.valor}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-100 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm">
          {opcion.etiqueta}
          {opcion.conteo !== undefined ? (
            <span className="rounded bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">{opcion.conteo}</span>
          ) : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
