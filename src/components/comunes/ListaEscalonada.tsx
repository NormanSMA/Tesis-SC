import { Children, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Retraso entre filas y tope de filas animadas (8 x 35 ms = 280 ms en total). */
export const PASO_ESCALONADO_MS = 35;
export const MAXIMO_ESCALONADO = 8;

export function retrasoEscalonado(indice: number): string | undefined {
  return indice > 0 && indice < MAXIMO_ESCALONADO ? `${indice * PASO_ESCALONADO_MS}ms` : undefined;
}

/** Lista cuyas filas entran de arriba hacia abajo. Cambiar la key del componente vuelve a animar. */
export function ListaEscalonada({ children, className, como: Etiqueta = "ul" }: { children: ReactNode; className?: string; como?: "ul" | "ol" | "div" }) {
  const Hijo = Etiqueta === "div" ? "div" : "li";
  return (
    <Etiqueta className={cn("flex flex-col gap-2", className)}>
      {Children.toArray(children).map((hijo, indice) => (
        <Hijo key={indice} className={cn(indice < MAXIMO_ESCALONADO && "animate-row-enter")} style={{ animationDelay: retrasoEscalonado(indice) }}>
          {hijo}
        </Hijo>
      ))}
    </Etiqueta>
  );
}
