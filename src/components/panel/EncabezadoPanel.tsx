"use client";

import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatearFecha } from "@/lib/formato";
import type { PanelDto, PerfilPanel } from "@/modules/panel/tipos";

type PerfilesProps = Pick<PanelDto, "perfil" | "perfilesDisponibles"> & {
  onCambiarPerfil: (perfil: PerfilPanel) => void;
};
type EncabezadoPanelProps = PerfilesProps & Pick<PanelDto, "pregunta" | "titulo" | "generadoEn"> & {
  puedeCrearCotizacion: boolean;
  actualizando: boolean;
  onActualizar: () => void;
};

// El perfil pulsado conserva el foco cuando la navegación cambia la clave del panel.
let perfilConFoco: PerfilPanel | null = null;

function PerfilesPanel({ perfil, perfilesDisponibles, onCambiarPerfil }: PerfilesProps) {
  const grupo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pendiente = perfilConFoco;
    perfilConFoco = null;
    if (pendiente === perfil) {
      grupo.current?.querySelector<HTMLButtonElement>(`button[data-perfil="${perfil}"]`)?.focus();
    }
  }, [perfil]);
  if (perfilesDisponibles.length < 2) return null;
  return (
    <div ref={grupo} role="group" aria-label="Perfil del panel" className="flex max-w-full flex-wrap gap-1 rounded-full border border-border/80 bg-card p-1">
      {perfilesDisponibles.map(({ codigo, nombre }) => (
        <button key={codigo} type="button" data-perfil={codigo} aria-pressed={perfil === codigo}
          onClick={() => { perfilConFoco = codigo; onCambiarPerfil(codigo); }}
          className={`min-h-10 min-w-10 max-w-full cursor-pointer rounded-full px-3 py-2 text-xs font-medium [overflow-wrap:anywhere] transition-opacity duration-100 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${perfil === codigo ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {nombre}
        </button>
      ))}
    </div>
  );
}

export function EncabezadoPanel(propiedades: EncabezadoPanelProps) {
  const { pregunta, titulo, generadoEn, puedeCrearCotizacion, actualizando, onActualizar } = propiedades;
  return (
    <header className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-72 [overflow-wrap:anywhere]">
        <p className="mb-1 text-xs text-muted-foreground">{pregunta}</p>
        <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
        <p role="status" aria-atomic="true" className="mt-1 text-xs text-muted-foreground">
          Actualizado: <time dateTime={generadoEn}>{formatearFecha(generadoEn)}</time>
        </p>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <PerfilesPanel {...propiedades} />
        <button type="button" onClick={onActualizar} aria-disabled={actualizando}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-xs font-semibold transition-opacity duration-100 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-wait aria-disabled:opacity-60">
          <RefreshCw aria-hidden="true" className="size-3.5" />Actualizar
        </button>
        {puedeCrearCotizacion && (
          <Link href="/cotizaciones?crear=1" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity duration-100 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Plus aria-hidden="true" className="size-4" />Nueva cotización
          </Link>
        )}
      </div>
    </header>
  );
}
