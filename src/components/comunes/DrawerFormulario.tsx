"use client";

import type { ComponentProps, ReactNode } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type PropiedadesDrawer = {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string;
  /** Barra de acciones fija al pie. */
  pie?: ReactNode;
  children: ReactNode;
  /** Bloquea el cierre por clic fuera mientras un modal hermano está abierto. */
  bloquearExterior?: boolean;
  className?: string;
};

type EventoExterior = Parameters<NonNullable<ComponentProps<typeof SheetContent>["onInteractOutside"]>>[0];

/**
 * Panel lateral derecho para formularios de negocio (max-w-xl).
 * Cabecera fija, cuerpo con scroll propio y pie de acciones fijo.
 */
export function DrawerFormulario({ abierto, alCambiar, titulo, descripcion, pie, children, bloquearExterior = false, className }: PropiedadesDrawer) {
  const alInteractuarFuera = (evento: EventoExterior) => { if (bloquearExterior) evento.preventDefault(); };
  return (
    <Sheet open={abierto} onOpenChange={alCambiar}>
      <SheetContent side="right" className={cn("gap-0 p-0", className)}
        onPointerDownOutside={alInteractuarFuera} onInteractOutside={alInteractuarFuera}
        onEscapeKeyDown={(evento) => { if (bloquearExterior) evento.preventDefault(); }}>
        <SheetHeader className="border-b border-border px-6 py-4 pr-14">
          <SheetTitle className="text-base font-semibold">{titulo}</SheetTitle>
          {descripcion ? <SheetDescription className="text-xs">{descripcion}</SheetDescription> : <SheetDescription className="sr-only">{titulo}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        {pie ? <div className="flex items-center justify-end gap-3 border-t border-border bg-slate-50 px-6 py-4">{pie}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
