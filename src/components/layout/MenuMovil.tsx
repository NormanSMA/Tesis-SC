"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { ListaNavegacion } from "./ListaNavegacion";
import { Marca } from "./Marca";
import type { GrupoNavegacion } from "./navegacion";

type PropiedadesMenuMovil = {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  grupos: GrupoNavegacion[];
  ruta: string;
};

export function MenuMovil({ abierto, alCambiarAbierto, grupos, ruta }: PropiedadesMenuMovil) {
  return (
    <Sheet open={abierto} onOpenChange={alCambiarAbierto}>
      <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0 sm:max-w-72">
        <SheetHeader className="h-14 justify-center border-b p-0 px-4">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SheetDescription className="sr-only">Opciones disponibles según su perfil.</SheetDescription>
          <Marca />
        </SheetHeader>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto p-3">
          <ListaNavegacion grupos={grupos} ruta={ruta} expandido alNavegar={() => alCambiarAbierto(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
