import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AtributosCampo = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

type PropiedadesCampo = {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  className?: string;
  /** Recibe los atributos de accesibilidad que debe llevar el control. */
  children: (atributos: AtributosCampo) => ReactNode;
};

export function FormField({ id, etiqueta, ayuda, error, requerido, className, children }: PropiedadesCampo) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripcion = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(" ");
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-base">
        {etiqueta}
        {requerido ? (
          <>
            <span aria-hidden="true" className="text-danger">
              *
            </span>
            <span className="sr-only">(obligatorio)</span>
          </>
        ) : null}
      </Label>
      {children({
        id,
        "aria-describedby": descripcion || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": requerido ? true : undefined,
      })}
      {ayuda ? (
        <p id={idAyuda} className="text-sm text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p id={idError} className="flex items-start gap-1.5 text-sm font-medium text-danger">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
