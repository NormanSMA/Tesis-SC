import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesVacio = {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  accion?: ReactNode;
  className?: string;
};

export function EmptyState({ titulo, descripcion, icono: Icono = Inbox, accion, className }: PropiedadesVacio) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-input bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icono aria-hidden="true" className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{titulo}</p>
        {descripcion ? <p className="mx-auto max-w-md text-sm text-muted-foreground">{descripcion}</p> : null}
      </div>
      {accion ? <div className="mt-1">{accion}</div> : null}
    </div>
  );
}
