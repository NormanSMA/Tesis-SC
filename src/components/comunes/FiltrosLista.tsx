import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PropiedadesFiltros = {
  etiqueta: string;
  action?: string;
  role?: "search";
  className?: string;
  children: ReactNode;
};

export function FiltrosLista({ etiqueta, action, role, className, children }: PropiedadesFiltros) {
  return (
    <form
      method="get"
      action={action}
      role={role}
      aria-label={etiqueta}
      className={cn("mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end", className)}
    >
      {children}
    </form>
  );
}

type PropiedadesCampo = {
  id: string;
  etiqueta: string;
  className?: string;
  children: (atributos: { id: string }) => ReactNode;
};

export function CampoFiltro({ id, etiqueta, className, children }: PropiedadesCampo) {
  return (
    <div className={cn("w-full min-w-0 space-y-2 sm:w-auto sm:min-w-40 sm:flex-1", className)}>
      <Label htmlFor={id} className="text-sm">
        {etiqueta}
      </Label>
      {children({ id })}
    </div>
  );
}

export function SelectFiltro({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-2 pr-9 pl-3 text-base shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}

export function AccionesFiltros({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:flex-wrap sm:justify-end [&>*]:h-10 [&>*]:w-full sm:[&>*]:w-auto">{children}</div>
  );
}
