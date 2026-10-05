import type { ReactNode } from "react";

type PropiedadesSeccion = {
  id: string;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
};

export function Seccion({ id, titulo, descripcion, children }: PropiedadesSeccion) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="scroll-mt-20 space-y-4">
      <div className="space-y-1 border-b pb-3">
        <h2 id={`${id}-titulo`} className="text-xl font-semibold text-foreground">
          {titulo}
        </h2>
        {descripcion ? <p className="text-sm text-muted-foreground">{descripcion}</p> : null}
      </div>
      {children}
    </section>
  );
}
