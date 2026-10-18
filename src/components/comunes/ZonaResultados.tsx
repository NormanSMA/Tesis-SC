"use client";

import type { ReactNode } from "react";

import { useEstadoLista } from "@/lib/listas/contexto-lista";
import { cn } from "@/lib/utils";

/** Envuelve la tabla: mientras llega la consulta nueva baja la opacidad y anuncia aria-busy. */
export function ZonaResultados({ children, className }: { children: ReactNode; className?: string }) {
  const pendiente = useEstadoLista()?.pendiente ?? false;
  return (
    <div aria-busy={pendiente} className={cn("transition-opacity duration-150 ease-out", pendiente && "opacity-60", className)}>
      {children}
    </div>
  );
}
