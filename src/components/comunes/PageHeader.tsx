import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesEncabezado = {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  className?: string;
};

export function PageHeader({ titulo, descripcion, acciones, className }: PropiedadesEncabezado) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
        {descripcion ? <p className="max-w-prose text-sm text-muted-foreground">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
