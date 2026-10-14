"use client";

import Link from "next/link";

import { PanelLeftCloseIcon } from "@/components/iconos-animados/panel-left-close";
import { cn } from "@/lib/utils";

import { BotonPanel } from "./BotonPanel";
import { ListaNavegacion } from "./ListaNavegacion";
import { Marca } from "./Marca";
import type { UsuarioSesion } from "@/lib/auth/sesion";

import type { GrupoNavegacion } from "./navegacion";
import { TarjetaUsuario } from "./TarjetaUsuario";

type PropiedadesBarra = {
  usuario: UsuarioSesion;
  grupos: GrupoNavegacion[];
  ruta: string;
  /** Solo aplica entre 768 y 1279 px: muestra el riel con etiquetas encima del contenido. */
  rielExpandido: boolean;
  /** Pantalla grande con el menú reducido a íconos. */
  compacto: boolean;
  alCerrarRiel: () => void;
  alCerrarRielConFoco: () => void;
};

export function BarraLateral({ usuario, grupos, ruta, rielExpandido, compacto, alCerrarRiel, alCerrarRielConFoco }: PropiedadesBarra) {
  return (
    <aside
      id="menu-principal"
      data-expandido={rielExpandido}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        !compacto && "xl:w-64",
        rielExpandido && "w-64 shadow-lg xl:shadow-none",
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <Link href="/panel" aria-label="TRACORE, Soluciones Creativas, ir al panel" className="rounded-md">
          {rielExpandido ? (
            <Marca />
          ) : (
            <>
              <Marca mostrarNombre={false} className={compacto ? undefined : "xl:hidden"} />
              {compacto ? null : <Marca className="hidden xl:flex" />}
            </>
          )}
        </Link>
        {rielExpandido ? (
          <BotonPanel
            Icono={PanelLeftCloseIcon}
            variant="ghost"
            size="icon"
            className="ml-auto xl:hidden"
            aria-label="Contraer menú de navegación"
            onClick={alCerrarRielConFoco}
            autoFocus
          />
        ) : null}
      </div>
      <nav aria-label="Principal" className={cn("flex-1 overflow-y-auto p-2", !compacto && "xl:p-3")}>
        <ListaNavegacion grupos={grupos} ruta={ruta} expandido={rielExpandido} compacto={compacto} alNavegar={alCerrarRiel} />
      </nav>
      <TarjetaUsuario usuario={usuario} modo={rielExpandido ? "amplia" : compacto ? "riel" : "adaptable"} />
    </aside>
  );
}
