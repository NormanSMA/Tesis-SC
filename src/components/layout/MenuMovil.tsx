"use client";

import { PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { ListaNavegacion } from "./ListaNavegacion";
import { Marca } from "./Marca";
import type { UsuarioSesion } from "@/lib/auth/sesion";

import type { GrupoNavegacion } from "./navegacion";
import { TarjetaUsuario } from "./TarjetaUsuario";

type PropiedadesMenuMovil = {
  usuario: UsuarioSesion;
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  grupos: GrupoNavegacion[];
  ruta: string;
};

export function MenuMovil({ usuario, abierto, alCambiarAbierto, grupos, ruta }: PropiedadesMenuMovil) {
  return (
    <Sheet open={abierto} onOpenChange={alCambiarAbierto}>
      <SheetContent side="left" showCloseButton={false} className="w-72 gap-0 bg-sidebar p-0 sm:max-w-72">
        <SheetHeader className="h-14 flex-row items-center justify-between gap-2 border-b p-0 px-4">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SheetDescription className="sr-only">Opciones disponibles según su perfil.</SheetDescription>
          <Marca />
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Cerrar menú de navegación">
              <PanelLeftClose aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto p-3">
          <ListaNavegacion grupos={grupos} ruta={ruta} expandido alNavegar={() => alCambiarAbierto(false)} />
        </nav>
        <TarjetaUsuario usuario={usuario} modo="amplia" />
      </SheetContent>
    </Sheet>
  );
}
