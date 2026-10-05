"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UsuarioSesion } from "@/lib/auth/sesion";

import { Migas } from "./Migas";
import { MenuUsuario } from "./MenuUsuario";

type PropiedadesBarra = {
  usuario: UsuarioSesion;
  ruta: string;
  rielExpandido: boolean;
  alAbrirMenuMovil: () => void;
  alAlternarRiel: () => void;
};

export function BarraSuperior({ usuario, ruta, rielExpandido, alAbrirMenuMovil, alAlternarRiel }: PropiedadesBarra) {
  const IconoRiel = rielExpandido ? PanelLeftClose : PanelLeftOpen;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-4 xl:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Abrir menú de navegación"
        onClick={alAbrirMenuMovil}
      >
        <Menu aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex xl:hidden"
        aria-label={rielExpandido ? "Contraer menú de navegación" : "Expandir menú de navegación"}
        aria-expanded={rielExpandido}
        aria-controls="menu-principal"
        id="alternar-riel"
        onClick={alAlternarRiel}
      >
        <IconoRiel aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1">
        <Migas ruta={ruta} />
      </div>
      <MenuUsuario usuario={usuario} />
    </header>
  );
}
