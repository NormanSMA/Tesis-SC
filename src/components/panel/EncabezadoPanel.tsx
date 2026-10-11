"use client";

import type { PanelDto, PerfilPanel } from "@/modules/panel/tipos";

type EncabezadoPanelProps = Pick<PanelDto, "pregunta" | "titulo" | "perfil" | "perfilesDisponibles"> & {
  onCambiarPerfil: (perfil: PerfilPanel) => void;
};

export function EncabezadoPanel({ pregunta, titulo, perfil, perfilesDisponibles, onCambiarPerfil }: EncabezadoPanelProps) {
  return (
    <header className="mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-80 [overflow-wrap:anywhere]">
        <p className="mb-1 text-sm text-muted-foreground">{pregunta}</p>
        <h1 className="max-w-[34ch] text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{titulo}</h1>
      </div>
      {perfilesDisponibles.length > 1 && (
        <div role="group" aria-label="Perfil del panel" className="flex max-w-full flex-wrap gap-1 rounded-3xl border bg-card p-1">
          {perfilesDisponibles.map(({ codigo, nombre }) => (
            <button
              key={codigo}
              type="button"
              aria-pressed={perfil === codigo}
              onClick={() => onCambiarPerfil(codigo)}
              className={`min-h-10 min-w-10 max-w-full cursor-pointer rounded-full px-4 py-2 text-sm [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${perfil === codigo ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {nombre}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
