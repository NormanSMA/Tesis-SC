"use client";

import { Menu } from "lucide-react";

import { PanelLeftCloseIcon } from "@/components/iconos-animados/panel-left-close";
import { PanelLeftOpenIcon } from "@/components/iconos-animados/panel-left-open";
import { Button } from "@/components/ui/button";

import { BotonPanel } from "./BotonPanel";
import { Migas } from "./Migas";

type PropiedadesBarra = {
  ruta: string;
  rielExpandido: boolean;
  compacto: boolean;
  alAbrirMenuMovil: () => void;
  alAlternarRiel: () => void;
  alAlternarCompacto: () => void;
};

export function BarraSuperior({ ruta, rielExpandido, compacto, alAbrirMenuMovil, alAlternarRiel, alAlternarCompacto }: PropiedadesBarra) {
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
      <BotonPanel
        Icono={rielExpandido ? PanelLeftCloseIcon : PanelLeftOpenIcon}
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex xl:hidden"
        aria-label={rielExpandido ? "Contraer menú de navegación" : "Expandir menú de navegación"}
        aria-expanded={rielExpandido}
        aria-controls="menu-principal"
        id="alternar-riel"
        onClick={alAlternarRiel}
      />
      <BotonPanel
        Icono={compacto ? PanelLeftOpenIcon : PanelLeftCloseIcon}
        variant="ghost"
        size="icon"
        className="hidden xl:inline-flex"
        aria-label={compacto ? "Expandir menú de navegación" : "Contraer menú de navegación"}
        aria-expanded={!compacto}
        aria-controls="menu-principal"
        onClick={alAlternarCompacto}
      />
      <div className="min-w-0 flex-1">
        <Migas ruta={ruta} />
      </div>
    </header>
  );
}
