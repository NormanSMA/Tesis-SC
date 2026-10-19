import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesSeccion = {
  titulo: string;
  descripcion?: string;
  /** Acción secundaria en la cabecera de la tarjeta, por ejemplo "Editar" o "Ver todo". */
  acciones?: ReactNode;
  /** Nivel del título; h2 por defecto. */
  nivel?: "h2" | "h3";
  /** Sin relleno en el cuerpo, para tablas que llegan al borde. */
  sinRelleno?: boolean;
  className?: string;
  children: ReactNode;
};

/** Tarjeta blanca con cabecera fina: la unidad de las fichas tipo bento. */
export function TarjetaSeccion({ titulo, descripcion, acciones, nivel = "h2", sinRelleno, className, children }: PropiedadesSeccion) {
  const Titulo = nivel;
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
        <div className="min-w-0">
          <Titulo className="text-base font-semibold text-foreground">{titulo}</Titulo>
          {descripcion ? <p className="text-sm text-slate-500">{descripcion}</p> : null}
        </div>
        {acciones ? <div className="flex items-center gap-2">{acciones}</div> : null}
      </header>
      <div className={sinRelleno ? undefined : "p-5"}>{children}</div>
    </section>
  );
}

export type DatoFicha = { etiqueta: string; valor: ReactNode; /** Ocupa toda la fila (textos largos). */ ancho?: boolean };

/** Lista de datos etiqueta y valor en rejilla. Un valor vacío se muestra como "—". */
export function ListaDatos({ datos, columnas = 2, className }: { datos: DatoFicha[]; columnas?: 2 | 3; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", columnas === 3 && "lg:grid-cols-3", className)}>
      {datos.map((dato) => (
        <div key={dato.etiqueta} className={cn("min-w-0", dato.ancho && "sm:col-span-full")}>
          <dt className="text-xs font-medium text-slate-500">{dato.etiqueta}</dt>
          <dd className="mt-1 text-sm font-medium break-words text-foreground">{dato.valor ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
