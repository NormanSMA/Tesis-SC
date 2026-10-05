import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

type PropiedadesKpi = {
  etiqueta: string;
  /** null o undefined muestra un guion de marcador. */
  valor?: string | number | null;
  ayuda?: string;
  icono?: LucideIcon;
};

export function KpiCard({ etiqueta, valor, ayuda, icono: Icono }: PropiedadesKpi) {
  const sinDato = valor === null || valor === undefined || valor === "";
  return (
    <Card className="gap-3 px-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
        {Icono ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Icono aria-hidden="true" className="size-5" />
          </span>
        ) : null}
      </div>
      <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {sinDato ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Sin datos</span>
          </>
        ) : (
          valor
        )}
      </p>
      {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
    </Card>
  );
}
