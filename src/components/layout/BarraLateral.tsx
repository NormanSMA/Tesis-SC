"use client";

import { PanelLeftClose } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ListaNavegacion, type ContadorMenu } from "./ListaNavegacion";
import { Marca } from "./Marca";
import type { UsuarioSesion } from "@/lib/auth/sesion";

import { inicioDeUsuario, type GrupoNavegacion } from "./navegacion";
import { destinoPorPerfil } from "@/core/permisos";
import { TarjetaUsuario } from "./TarjetaUsuario";

type PropiedadesBarra = {
  usuario: UsuarioSesion;
  grupos: GrupoNavegacion[];
  ruta: string;
  /** Solo aplica entre 768 y 1279 px: muestra el riel con etiquetas encima del contenido. */
  rielExpandido: boolean;
  /** Pantalla grande con el menú reducido a íconos. */
  compacto: boolean;
  contadores?: Record<string, ContadorMenu>;
  /** Buscador global; recibe si el menú muestra etiquetas y si esa instancia escucha Ctrl+K. */
  buscador?: (amplio: boolean, atajo: boolean) => ReactNode;
  alCerrarRiel: () => void;
  alCerrarRielConFoco: () => void;
  alContraer: () => void;
};

function CabeceraMarca({ usuario, rielExpandido, compacto, alCerrarRielConFoco, alContraer }: Pick<PropiedadesBarra, "usuario" | "rielExpandido" | "compacto" | "alCerrarRielConFoco" | "alContraer">) {
  const inicio = inicioDeUsuario(destinoPorPerfil[usuario.perfil], usuario.permisos);
  return (
    <div className={cn("flex h-16 shrink-0 items-center gap-2 px-3", !compacto && "xl:px-4")}>
      <Link href={inicio} aria-label="TRACORE, Soluciones Creativas, ir a mi inicio" className="min-w-0 rounded-xl">
        {rielExpandido ? (
          <Marca conCaja />
        ) : (
          <>
            <Marca conCaja mostrarNombre={false} className={compacto ? undefined : "xl:hidden"} />
            {compacto ? null : <Marca conCaja className="hidden xl:flex" />}
          </>
        )}
      </Link>
      {rielExpandido ? (
        <Button variant="ghost" size="icon" className="ml-auto text-slate-500 xl:hidden" aria-label="Contraer menú de navegación"
          onClick={alCerrarRielConFoco} autoFocus>
          <PanelLeftClose aria-hidden="true" />
        </Button>
      ) : null}
      {/* Desde 1280 px el botón de contraer vive junto a la marca, como en Mise. */}
      {!compacto && !rielExpandido ? (
        <Button variant="ghost" size="icon" className="ml-auto hidden text-slate-500 hover:bg-slate-200/60 xl:inline-flex"
          aria-label="Contraer menú de navegación" aria-expanded aria-controls="menu-principal" onClick={alContraer}>
          <PanelLeftClose aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function BarraLateral(propiedades: PropiedadesBarra) {
  const { usuario, grupos, ruta, rielExpandido, compacto, contadores, buscador, alCerrarRiel } = propiedades;
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
      <CabeceraMarca {...propiedades} />
      {buscador ? (
        <div className={cn("px-3 pb-3", !compacto && "xl:px-4")}>
          {rielExpandido ? buscador(true, true) : (
            <>
              <div className={compacto ? undefined : "xl:hidden"}>{buscador(false, compacto)}</div>
              {compacto ? null : <div className="hidden xl:block">{buscador(true, true)}</div>}
            </>
          )}
        </div>
      ) : null}
      <nav aria-label="Principal" className={cn("flex-1 overflow-y-auto px-2 pb-3", !compacto && "xl:px-3")}>
        <ListaNavegacion grupos={grupos} ruta={ruta} expandido={rielExpandido} compacto={compacto} contadores={contadores} alNavegar={alCerrarRiel} />
      </nav>
      <TarjetaUsuario usuario={usuario} modo={rielExpandido ? "amplia" : compacto ? "riel" : "adaptable"} />
    </aside>
  );
}
