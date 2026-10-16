"use client";

import Link from "next/link";
import { Fragment } from "react";

import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { GrupoNavegacion, ItemNavegacion } from "./navegacion";

type PropiedadesLista = {
  grupos: GrupoNavegacion[];
  ruta: string;
  /** true: etiquetas siempre visibles (menú móvil y riel expandido). false: etiquetas solo desde 1280 px. */
  expandido: boolean;
  /** true: riel de solo íconos también desde 1280 px (el usuario contrajo el menú). */
  compacto?: boolean;
  alNavegar?: () => void;
};

function esRutaActiva(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(`${href}/`);
}

function EnlaceItem({
  item,
  activo,
  expandido,
  compacto = false,
  alNavegar,
}: { item: ItemNavegacion; activo: boolean } & Pick<PropiedadesLista, "expandido" | "compacto" | "alNavegar">) {
  const Icono = item.icono;
  const enlace = (
    <Link
      href={item.href}
      onClick={alNavegar}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent",
        activo && "bg-primary-soft font-semibold text-primary hover:bg-primary-soft",
        !expandido && (compacto ? "justify-center px-0" : "justify-center px-0 xl:justify-start xl:px-3"),
      )}
    >
      {activo ? (
        <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand-gold" />
      ) : null}
      <Icono aria-hidden="true" className="size-5 shrink-0" />
      <span className={cn("truncate", !expandido && (compacto ? "sr-only" : "sr-only xl:not-sr-only"))}>{item.etiqueta}</span>
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

function EncabezadoGrupo({ etiqueta, expandido, compacto }: { etiqueta: string; expandido: boolean; compacto: boolean }) {
  return (
    <>
      {!expandido ? <Separator className={compacto ? "my-2" : "my-2 xl:hidden"} /> : null}
      <p
        className={cn(
          "px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
          !expandido && (compacto ? "hidden" : "hidden xl:block"),
        )}
      >
        {etiqueta}
      </p>
    </>
  );
}

export function ListaNavegacion({ grupos, ruta, expandido, compacto = false, alNavegar }: PropiedadesLista) {
  return (
    <ul className="flex flex-col gap-1">
      {grupos.map((grupo) => (
        <Fragment key={grupo.id}>
          {grupo.etiqueta ? (
            <li>
              <EncabezadoGrupo etiqueta={grupo.etiqueta} expandido={expandido} compacto={compacto} />
            </li>
          ) : null}
          {grupo.items.map((item) => (
            <li key={item.href}>
              <EnlaceItem
                item={item}
                activo={esRutaActiva(ruta, item.href)}
                expandido={expandido}
                compacto={compacto}
                alNavegar={alNavegar}
              />
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );
}
