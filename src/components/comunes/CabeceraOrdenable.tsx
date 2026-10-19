"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import type { DireccionOrden } from "@/lib/listas/orden";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { cn } from "@/lib/utils";

type PropiedadesCabecera = {
  campo: string;
  etiqueta: string;
  /** Dirección activa de este campo o null si la tabla ordena por otro. */
  activa: DireccionOrden | null;
  parametro?: string;
  alinearDerecha?: boolean;
};

/** Botón de cabecera: neutro, ascendente, descendente y vuelta al orden por defecto. El aria-sort va en el th. */
export function CabeceraOrdenable({ campo, etiqueta, activa, parametro = "orden", alinearDerecha }: PropiedadesCabecera) {
  const { navegar } = useParametrosUrl();
  const siguiente = activa === null ? `${campo}:asc` : activa === "asc" ? `${campo}:desc` : null;
  const Icono = activa === "asc" ? ArrowUp : activa === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button type="button" onClick={() => navegar({ [parametro]: siguiente })}
      className={cn("-mx-2 inline-flex h-8 items-center gap-1 rounded-md px-2 font-semibold transition-colors duration-100 hover:bg-slate-200/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        alinearDerecha && "flex-row-reverse", activa && "text-slate-900")}>
      {etiqueta}
      <Icono aria-hidden="true" className={cn("size-3.5", !activa && "text-slate-400")} />
      <span className="sr-only">{siguiente === null ? ", quitar orden" : siguiente.endsWith("asc") ? ", ordenar ascendente" : ", ordenar descendente"}</span>
    </button>
  );
}
