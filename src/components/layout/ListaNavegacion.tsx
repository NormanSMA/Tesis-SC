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
  alNavegar?: () => void;
};

function esRutaActiva(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(`${href}/`);
}

function EnlaceItem({
  item,
  activo,
  expandido,
  alNavegar,
}: { item: ItemNavegacion; activo: boolean } & Pick<PropiedadesLista, "expandido" | "alNavegar">) {
  const Icono = item.icono;
  const enlace = (
    <Link
      href={item.href}
      onClick={alNavegar}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent",
        activo && "bg-primary-soft text-primary hover:bg-primary-soft",
        !expandido && "justify-center px-0 xl:justify-start xl:px-3",
      )}
    >
      {activo ? (
        <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
      ) : null}
      <Icono aria-hidden="true" className="size-5 shrink-0" />
      <span className={cn("truncate", !expandido && "sr-only xl:not-sr-only")}>{item.etiqueta}</span>
    </Link>
  );
  if (expandido) return enlace;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{enlace}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="xl:hidden">
        {item.etiqueta}
      </TooltipContent>
    </Tooltip>
  );
}

function EncabezadoGrupo({ etiqueta, expandido }: { etiqueta: string; expandido: boolean }) {
  return (
    <>
      {!expandido ? <Separator className="my-2 xl:hidden" /> : null}
      <p
        className={cn(
          "px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
          !expandido && "hidden xl:block",
        )}
      >
        {etiqueta}
      </p>
    </>
  );
}

export function ListaNavegacion({ grupos, ruta, expandido, alNavegar }: PropiedadesLista) {
  return (
    <ul className="flex flex-col gap-1">
      {grupos.map((grupo) => (
        <Fragment key={grupo.id}>
          {grupo.etiqueta ? (
            <li>
              <EncabezadoGrupo etiqueta={grupo.etiqueta} expandido={expandido} />
            </li>
          ) : null}
          {grupo.items.map((item) => (
            <li key={item.href}>
              <EnlaceItem
                item={item}
                activo={esRutaActiva(ruta, item.href)}
                expandido={expandido}
                alNavegar={alNavegar}
              />
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );
}
