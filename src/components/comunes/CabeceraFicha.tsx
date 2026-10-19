import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PropiedadesCabecera = {
  titulo: string;
  /** Avatar, ícono en caja o ilustración a la izquierda del título. */
  marca?: ReactNode;
  /** Fila breve bajo el título: código, estado y uno o dos datos clave. */
  meta?: ReactNode;
  /** Acciones a la derecha: la primera es el siguiente paso y la única con énfasis. */
  acciones?: ReactNode;
  /** Enlace de vuelta a la lista o a la ficha padre. */
  volver?: { href: string; etiqueta: string };
  className?: string;
};

/** Cabecera de ficha y de formulario: identidad a la izquierda, acciones a la derecha. Contiene el h1 de la página. */
export function CabeceraFicha({ titulo, marca, meta, acciones, volver, className }: PropiedadesCabecera) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {volver ? (
        <Link href={volver.href}
          className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 text-sm text-slate-500 transition-colors duration-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <ChevronLeft aria-hidden="true" className="size-4" />
          {volver.etiqueta}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {marca ? <div className="shrink-0">{marca}</div> : null}
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight break-words text-foreground">{titulo}</h1>
            {meta ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-500">{meta}</div> : null}
          </div>
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
      </div>
    </div>
  );
}

/** Ícono en caja para la cabecera, mismo estilo que las tarjetas de métrica. */
export function MarcaIcono({ children, destacada }: { children: ReactNode; destacada?: boolean }) {
  return (
    <span aria-hidden="true" className={cn("flex size-12 items-center justify-center rounded-xl ring-1 [&_svg]:size-5",
      destacada ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-slate-600 ring-border shadow-sm")}>
      {children}
    </span>
  );
}
