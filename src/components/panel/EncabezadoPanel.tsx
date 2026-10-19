"use client";

import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import type { PanelDto, PerfilPanel } from "@/modules/panel/tipos";

// La fecha ya va en la barra superior: aquí solo la hora de la última carga (zona fija, igual en servidor y cliente).
const HORA = new Intl.DateTimeFormat("es-NI", { hour: "numeric", minute: "2-digit", timeZone: "America/Managua" });

type PerfilesProps = Pick<PanelDto, "perfil" | "perfilesDisponibles"> & {
  onCambiarPerfil: (perfil: PerfilPanel) => void;
};
type EncabezadoPanelProps = PerfilesProps & Pick<PanelDto, "pregunta" | "titulo" | "generadoEn"> & {
  puedeCrearCotizacion: boolean;
  /** Sin indicadores por permisos: se muestra el mensaje del servicio bajo la pregunta. */
  sinDatos?: boolean;
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
    <div ref={grupo} role="group" aria-label="Perfil del panel" className="flex max-w-full flex-wrap gap-0.5 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1">
      {perfilesDisponibles.map(({ codigo, nombre }) => (
        <button key={codigo} type="button" data-perfil={codigo} aria-pressed={perfil === codigo}
          onClick={() => { perfilConFoco = codigo; onCambiarPerfil(codigo); }}
          className={`min-h-9 min-w-10 max-w-full cursor-pointer rounded-lg px-3.5 text-sm [overflow-wrap:anywhere] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${perfil === codigo ? "bg-card font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"}`}>
          {nombre}
        </button>
      ))}
    </div>
  );
}

export function EncabezadoPanel(propiedades: EncabezadoPanelProps) {
  const { pregunta, titulo, generadoEn, puedeCrearCotizacion, actualizando, onActualizar, sinDatos } = propiedades;
  // El título es la pregunta del perfil; el resumen en frase repetía la primera tarjeta y solo se muestra sin datos.
  return (
    <header className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-72 [overflow-wrap:anywhere]">
        <h1 className="text-xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-2xl">{pregunta}</h1>
        {sinDatos ? <p className="mt-1 text-sm text-slate-500">{titulo}</p> : null}
        {/* La hora visible está en la barra superior; aquí solo se anuncia la actualización a lectores de pantalla. */}
        <p role="status" aria-atomic="true" className="sr-only">
          Actualizado: <time dateTime={generadoEn}>{HORA.format(new Date(generadoEn))}</time>
        </p>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <PerfilesPanel {...propiedades} />
        <button type="button" onClick={onActualizar} aria-disabled={actualizando}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-card px-3.5 text-sm font-medium text-slate-800 shadow-sm transition-colors duration-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-wait aria-disabled:opacity-60">
          <RefreshCw aria-hidden="true" className={`size-4 text-slate-500 ${actualizando ? "animate-spin" : ""}`} />Actualizar
        </button>
        {puedeCrearCotizacion && (
          <Link href="/cotizaciones?crear=1" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-100 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Plus aria-hidden="true" className="size-4" />Nueva cotización
          </Link>
        )}
      </div>
    </header>
  );
}
