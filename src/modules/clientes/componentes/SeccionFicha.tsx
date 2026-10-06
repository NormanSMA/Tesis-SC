import type { ReactNode } from "react";

type PropiedadesSeccion = {
  id: string;
  titulo: string;
  /** Texto breve a la derecha del título, por ejemplo "Mostrando 20 de 27". */
  nota?: string;
  children: ReactNode;
};

export function SeccionFicha({ id, titulo, nota, children }: PropiedadesSeccion) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-xl font-semibold tracking-tight text-foreground">
          {titulo}
        </h2>
        {nota ? <p className="text-sm text-muted-foreground">{nota}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function textoMostrando(mostrados: number, total: number): string {
  return `Mostrando ${mostrados} de ${total}`;
}
