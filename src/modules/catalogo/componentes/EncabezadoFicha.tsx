import type { ReactNode } from "react";

import { IconoServicio } from "@/components/comunes/IconoServicio";
import { servicioDeCategoria } from "@/lib/servicios";

type PropiedadesEncabezado = {
  titulo: string;
  /** Código visible de la ficha, por ejemplo PRO-0001. */
  codigo: string;
  /** Datos breves junto al código, por ejemplo la categoría. */
  detalle?: string;
  /** Categoría del producto. Si tiene ilustración, se muestra a la izquierda del título. */
  categoria?: string;
  /** Etiqueta de estado con texto. */
  estado: ReactNode;
  /** Acciones: la primera es el siguiente paso y la única con énfasis. */
  acciones?: ReactNode;
};

export function EncabezadoFicha({ titulo, codigo, detalle, categoria, estado, acciones }: PropiedadesEncabezado) {
  const conIlustracion = categoria ? servicioDeCategoria(categoria) !== null : false;
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        {conIlustracion && categoria ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted sm:size-[72px]">
            <IconoServicio categoria={categoria} tamano={32} className="sm:hidden" />
            <IconoServicio categoria={categoria} tamano={56} className="hidden sm:block" />
          </div>
        ) : null}
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-foreground">{titulo}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{codigo}</span>
            {estado}
            {detalle ? <span>{detalle}</span> : null}
          </div>
        </div>
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
