import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Agrupa controles repetidos bajo una etiqueta. Usa role=group: un label no puede apuntar a un div. */
export function GrupoCampo({ id, etiqueta, error, className = "space-y-5", children }: {
  id: string; etiqueta: string; error?: string; className?: string; children: ReactNode;
}) {
  const idEtiqueta = `${id}-etiqueta`;
  const idError = `${id}-error`;
  return <div role="group" aria-labelledby={idEtiqueta} className="space-y-2">
    <p id={idEtiqueta} className="text-base leading-none font-medium">{etiqueta}</p>
    <div id={id} tabIndex={-1} aria-describedby={error ? idError : undefined}
      aria-invalid={error ? true : undefined} className={className}>
      {children}
    </div>
    <div aria-live="polite">
      {error ? <p id={idError} className="flex items-start gap-1.5 text-sm font-medium text-danger">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{error}</span>
      </p> : null}
    </div>
  </div>;
}
