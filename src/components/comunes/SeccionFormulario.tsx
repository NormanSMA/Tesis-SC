import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesSeccion = {
  titulo: string;
  descripcion?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Bloque de formulario en dos columnas desde lg: a la izquierda qué se pide y por qué,
 * a la derecha los campos en una tarjeta. En móvil y tableta, el texto va arriba de la tarjeta.
 */
export function SeccionFormulario({ titulo, descripcion, className, children }: PropiedadesSeccion) {
  return (
    <section className={cn("grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8", className)}>
      <div className="lg:pt-1">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {descripcion ? <p className="mt-1 text-sm text-slate-500">{descripcion}</p> : null}
      </div>
      <div className="min-w-0 space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm">{children}</div>
    </section>
  );
}

/** Contenedor de página de formulario: ancho cómodo y separación entre secciones. */
export function CuerpoFormulario({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-5xl space-y-8", className)}>{children}</div>;
}

/**
 * Barra de acciones fija al pie de la pantalla mientras el formulario es más alto que la ventana.
 * La acción principal va a la derecha; "Cancelar" a su izquierda. En móvil ocupan todo el ancho.
 */
export function PieFormulario({ estado, children, className }: { estado?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-10 -mx-4 mt-8 border-t border-border/80 bg-background/90 px-4 py-3 backdrop-blur-sm xl:-mx-8 xl:px-8", className)}>
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-end gap-2 max-sm:[&>*]:flex-1">
        {estado ? <div className="mr-auto text-sm text-slate-500 max-sm:basis-full">{estado}</div> : null}
        {children}
      </div>
    </div>
  );
}
