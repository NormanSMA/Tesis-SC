import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesError = {
  titulo?: string;
  descripcion?: string;
  accion?: ReactNode;
  className?: string;
};

export function ErrorState({
  titulo = "No se pudo cargar la información",
  descripcion = "Ocurrió un problema. Intente de nuevo en unos segundos.",
  accion,
  className,
}: PropiedadesError) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-danger-soft-border bg-danger-soft px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-card text-danger">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-danger">{titulo}</p>
        <p className="mx-auto max-w-md text-sm text-foreground">{descripcion}</p>
      </div>
      {accion ? <div className="mt-1">{accion}</div> : null}
    </div>
  );
}
