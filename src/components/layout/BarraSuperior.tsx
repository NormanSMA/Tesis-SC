"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Migas } from "./Migas";

type PropiedadesBarra = {
  ruta: string;
  /** Fecha de hoy ya formateada por el servidor; se muestra junto a las migas del panel. */
  fechaHoy?: string;
  rielExpandido: boolean;
  compacto: boolean;
  alAbrirMenuMovil: () => void;
  alAlternarRiel: () => void;
  alAlternarCompacto: () => void;
};

export function BarraSuperior({ ruta, fechaHoy, rielExpandido, compacto, alAbrirMenuMovil, alAlternarRiel, alAlternarCompacto }: PropiedadesBarra) {
  const IconoRiel = rielExpandido ? PanelLeftClose : PanelLeftOpen;
  const IconoCompacto = compacto ? PanelLeftOpen : PanelLeftClose;
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
      <Button
        variant="ghost"
        size="icon"
        className="hidden xl:inline-flex"
        aria-label={compacto ? "Expandir menú de navegación" : "Contraer menú de navegación"}
        aria-expanded={!compacto}
        aria-controls="menu-principal"
        onClick={alAlternarCompacto}
      >
        <IconoCompacto aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Migas ruta={ruta} />
        {fechaHoy && ruta === "/panel" ? (
          <span className="truncate text-sm text-muted-foreground first-letter:uppercase">{fechaHoy}</span>
        ) : null}
      </div>
    </header>
  );
}
