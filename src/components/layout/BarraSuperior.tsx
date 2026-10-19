"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Migas } from "./Migas";
import { Reloj } from "./Reloj";
import { gruposNavegacion, itemActivo } from "./navegacion";

type PropiedadesBarra = {
  ruta: string;
  /** Fecha de hoy ya formateada por el servidor; se muestra junto al título del panel. */
  fechaHoy?: string;
  rielExpandido: boolean;
  compacto: boolean;
  alAbrirMenuMovil: () => void;
  alAlternarRiel: () => void;
  alAlternarCompacto: () => void;
};

const BOTON_MENU = "text-slate-500 hover:bg-slate-200/60 hover:text-slate-900";

// Cabecera estilo Mise: ícono de la sección, título grande y fecha. Contraer el menú vive junto a la marca.
export function BarraSuperior({ ruta, fechaHoy, rielExpandido, compacto, alAbrirMenuMovil, alAlternarRiel, alAlternarCompacto }: PropiedadesBarra) {
  const IconoRiel = rielExpandido ? PanelLeftClose : PanelLeftOpen;
  const IconoSeccion = itemActivo(gruposNavegacion, ruta)?.icono;
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200/70 bg-background/90 px-4 backdrop-blur-sm xl:px-8">
      <Button variant="ghost" size="icon" className={cn("md:hidden", BOTON_MENU)} aria-label="Abrir menú de navegación" onClick={alAbrirMenuMovil}>
        <Menu aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" className={cn("hidden md:inline-flex xl:hidden", BOTON_MENU)}
        aria-label={rielExpandido ? "Contraer menú de navegación" : "Expandir menú de navegación"}
        aria-expanded={rielExpandido} aria-controls="menu-principal" id="alternar-riel" onClick={alAlternarRiel}>
        <IconoRiel aria-hidden="true" />
      </Button>
      {compacto ? (
        <Button variant="ghost" size="icon" className={cn("hidden xl:inline-flex", BOTON_MENU)} aria-label="Expandir menú de navegación"
          aria-expanded={false} aria-controls="menu-principal" onClick={alAlternarCompacto}>
          <PanelLeftOpen aria-hidden="true" />
        </Button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {IconoSeccion ? <IconoSeccion aria-hidden="true" className="hidden size-5 shrink-0 text-slate-500 sm:block" /> : null}
        <Migas ruta={ruta} />
        {fechaHoy && ruta === "/panel" ? (
          <span className="hidden truncate text-base text-slate-500 first-letter:uppercase sm:inline">{fechaHoy}</span>
        ) : null}
      </div>
      <Reloj />
    </header>
  );
}
