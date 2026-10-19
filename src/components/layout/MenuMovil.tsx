"use client";

import { PanelLeftClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { BuscadorGlobal } from "./BuscadorGlobal";
import { ListaNavegacion, type ContadorMenu } from "./ListaNavegacion";
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
  contadores?: Record<string, ContadorMenu>;
};

// Mismo menú que en escritorio: marca en caja, buscador global y contadores por módulo.
export function MenuMovil({ usuario, abierto, alCambiarAbierto, grupos, ruta, contadores }: PropiedadesMenuMovil) {
  return (
    <Sheet open={abierto} onOpenChange={alCambiarAbierto}>
      <SheetContent side="left" showCloseButton={false} className="w-72 max-w-[85vw] gap-0 bg-sidebar p-0 sm:max-w-72">
        <SheetHeader className="h-16 flex-row items-center justify-between gap-2 p-0 px-3">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <SheetDescription className="sr-only">Opciones disponibles según su perfil.</SheetDescription>
          <Marca conCaja />
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-200/60" aria-label="Cerrar menú de navegación">
              <PanelLeftClose aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="px-3 pb-3">
          <BuscadorGlobal permisos={usuario.permisos} modo="amplio" atajo={false} />
        </div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto px-2 pb-3">
          <ListaNavegacion grupos={grupos} ruta={ruta} expandido contadores={contadores} alNavegar={() => alCambiarAbierto(false)} />
        </nav>
        <TarjetaUsuario usuario={usuario} modo="amplia" />
      </SheetContent>
    </Sheet>
  );
}
