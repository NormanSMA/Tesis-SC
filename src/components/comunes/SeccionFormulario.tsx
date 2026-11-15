import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesSeccion = {
  titulo: string;
  descripcion?: string;
  className?: string;
  vertical?: boolean;
  children: ReactNode;
};

/**
 * El encabezado precede a los campos en todos los anchos de pantalla.
 */
export function SeccionFormulario({ titulo, descripcion, className, children }: PropiedadesSeccion) {
  return (
    <section className={cn("grid min-w-0 gap-3", className)}>
      <div className="border-l-4 border-primary/60 pl-3">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {descripcion ? <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p> : null}
      </div>
      <div className="min-w-0 space-y-4 rounded-xl border-[1.5px] border-formulario bg-secondary/40 p-5 shadow-sm">{children}</div>
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
