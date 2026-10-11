"use client";

import { useEffect, useRef } from "react";

import type { PanelDto, PerfilPanel } from "@/modules/panel/tipos";

type EncabezadoPanelProps = Pick<PanelDto, "pregunta" | "titulo" | "perfil" | "perfilesDisponibles"> & {
  onCambiarPerfil: (perfil: PerfilPanel) => void;
};

const VIGENCIA_FOCO_MS = 10_000;

// Cambiar de perfil remonta el panel (la página usa key). El perfil pulsado sobrevive al remontaje.
let perfilConFoco: { codigo: PerfilPanel; momento: number } | null = null;

export function EncabezadoPanel({ pregunta, titulo, perfil, perfilesDisponibles, onCambiarPerfil }: EncabezadoPanelProps) {
  const grupo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pendiente = perfilConFoco;
    perfilConFoco = null;
    if (!pendiente || pendiente.codigo !== perfil || Date.now() - pendiente.momento > VIGENCIA_FOCO_MS) return;
    grupo.current?.querySelector<HTMLButtonElement>(`button[data-perfil="${pendiente.codigo}"]`)?.focus();
  }, [perfil]);
  return (
    <header className="mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-80 [overflow-wrap:anywhere]">
        <p className="mb-1 text-sm text-muted-foreground">{pregunta}</p>
        <h1 className="max-w-[34ch] text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{titulo}</h1>
      </div>
      {perfilesDisponibles.length > 1 && (
        <div ref={grupo} role="group" aria-label="Perfil del panel" className="flex max-w-full flex-wrap gap-1 rounded-3xl border bg-card p-1">
          {perfilesDisponibles.map(({ codigo, nombre }) => (
            <button
              key={codigo}
              type="button"
              data-perfil={codigo}
              aria-pressed={perfil === codigo}
              onClick={() => {
                perfilConFoco = { codigo, momento: Date.now() };
                onCambiarPerfil(codigo);
              }}
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
