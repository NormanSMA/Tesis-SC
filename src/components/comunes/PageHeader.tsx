import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesEncabezado = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  /**
   * false en las páginas raíz de un módulo: la barra superior ya muestra el nombre de la sección,
   * así que el h1 queda solo para lectores de pantalla y no se repite el título.
   */
  tituloVisible?: boolean;
  className?: string;
};

export function PageHeader({ titulo, descripcion, acciones, tituloVisible = true, className }: PropiedadesEncabezado) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", !tituloVisible && "items-center", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className={tituloVisible ? "text-2xl font-semibold tracking-tight text-foreground" : "sr-only"}>{titulo}</h1>
        {descripcion ? <p className="max-w-prose text-sm text-slate-500">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
