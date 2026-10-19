"use client";

import Link from "next/link";
import { Fragment } from "react";

import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { GrupoNavegacion, ItemNavegacion } from "./navegacion";

export type ContadorMenu = { total: number; tono: "neutro" | "peligro" };

type PropiedadesLista = {
  grupos: GrupoNavegacion[];
  ruta: string;
  /** true: etiquetas siempre visibles (menú móvil y riel expandido). false: etiquetas solo desde 1280 px. */
  expandido: boolean;
  /** true: riel de solo íconos también desde 1280 px (el usuario contrajo el menú). */
  compacto?: boolean;
  /** Pendientes por módulo (clave = href). */
  contadores?: Record<string, ContadorMenu>;
  alNavegar?: () => void;
};

function esRutaActiva(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(`${href}/`);
}

// Clases que muestran un elemento solo cuando el menú tiene etiquetas.
function soloConEtiquetas(expandido: boolean, compacto: boolean): string | undefined {
  if (expandido) return undefined;
  return compacto ? "hidden" : "hidden xl:inline-flex";
}

function Contador({ contador, expandido, compacto }: { contador: ContadorMenu; expandido: boolean; compacto: boolean }) {
  const peligro = contador.tono === "peligro";
  return (
    <>
      <span aria-hidden="true" className={cn("ml-auto min-w-6 justify-center rounded-md px-1.5 text-[11px] leading-5 font-semibold tabular-nums",
        peligro ? "bg-danger text-white" : "border border-slate-200 bg-white text-slate-600",
        soloConEtiquetas(expandido, compacto) ?? "inline-flex")}>
        {contador.total > 99 ? "99+" : contador.total}
      </span>
      {/* En el riel de íconos el contador se reduce a un punto sobre el ícono. */}
      {!expandido ? (
        <span aria-hidden="true" className={cn("absolute top-1.5 right-2 size-2 rounded-full ring-2 ring-sidebar",
          peligro ? "bg-danger" : "bg-slate-400", compacto ? undefined : "xl:hidden")} />
      ) : null}
    </>
  );
}

function EnlaceItem({
  item,
  activo,
  expandido,
  compacto = false,
  contador,
  alNavegar,
}: { item: ItemNavegacion; activo: boolean; contador?: ContadorMenu } & Pick<PropiedadesLista, "expandido" | "compacto" | "alNavegar">) {
  const Icono = item.icono;
  const enlace = (
    <Link
      href={item.href}
      onClick={alNavegar}
      aria-current={activo ? "page" : undefined}
      // El contador va como descripción: no altera el nombre accesible del enlace.
      aria-description={contador ? `${contador.total} pendientes` : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-slate-600 transition-colors duration-100 ease-out hover:bg-slate-200/60 hover:text-slate-900",
        activo && "bg-card font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80 hover:bg-card",
        !expandido && (compacto ? "justify-center px-0" : "justify-center px-0 xl:justify-start xl:px-3"),
      )}
    >
      <Icono aria-hidden="true" className={cn("size-[18px] shrink-0", activo ? "text-primary" : "text-slate-500")} />
      <span className={cn("truncate", !expandido && (compacto ? "sr-only" : "sr-only xl:not-sr-only"))}>{item.etiqueta}</span>
      {contador ? <Contador contador={contador} expandido={expandido} compacto={compacto} /> : null}
    </Link>
  );
  if (expandido) return enlace;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{enlace}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className={compacto ? undefined : "xl:hidden"}>
        {item.etiqueta}
      </TooltipContent>
    </Tooltip>
  );
}

function EncabezadoGrupo({ etiqueta, expandido, compacto, primero }: { etiqueta: string; expandido: boolean; compacto: boolean; primero: boolean }) {
  return (
    <>
      {!expandido && !primero ? <Separator className={compacto ? "my-2" : "my-2 xl:hidden"} /> : null}
      <p
        className={cn(
          "px-3 pb-1.5 text-xs font-medium text-slate-600",
          primero ? "pt-1" : "pt-5",
          !expandido && (compacto ? "hidden" : "hidden xl:block"),
        )}
      >
        {etiqueta}
      </p>
    </>
  );
}

export function ListaNavegacion({ grupos, ruta, expandido, compacto = false, contadores = {}, alNavegar }: PropiedadesLista) {
  return (
    <ul className="flex flex-col gap-0.5">
      {grupos.map((grupo, indice) => (
        <Fragment key={grupo.id}>
          {grupo.etiqueta ? (
            <li>
              <EncabezadoGrupo etiqueta={grupo.etiqueta} expandido={expandido} compacto={compacto} primero={indice === 0} />
            </li>
          ) : null}
          {grupo.items.map((item) => (
            <li key={item.href}>
              <EnlaceItem
                item={item}
                activo={esRutaActiva(ruta, item.href)}
                expandido={expandido}
                compacto={compacto}
                contador={contadores[item.href]}
                alNavegar={alNavegar}
              />
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );
}
