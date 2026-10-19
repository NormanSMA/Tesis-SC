"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import { cn } from "@/lib/utils";

type PropiedadesBuscador = {
  etiqueta: string;
  marcador?: string;
  parametro?: string;
  retrasoMs?: number;
  className?: string;
};

function esCampoEditable(objetivo: EventTarget | null): boolean {
  return objetivo instanceof HTMLElement && Boolean(objetivo.closest("input, textarea, select, [contenteditable='true']"));
}

/**
 * Búsqueda en vivo: escribe en la URL 250 ms después de la última tecla y vuelve a la página 1.
 * El texto local no se pisa con respuestas viejas; si la URL cambia desde fuera (limpiar filtros), se sincroniza.
 * Atajo "/" enfoca el campo.
 */
export function BuscadorEnVivo({ etiqueta, marcador = "Buscar…", parametro = "q", retrasoMs = 250, className }: PropiedadesBuscador) {
  const { parametros, navegar, pendiente } = useParametrosUrl();
  const enUrl = parametros.get(parametro) ?? "";
  const [texto, setTexto] = useState(enUrl);
  const [enviado, setEnviado] = useState(enUrl);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();

  // La URL cambió por otra vía (limpiar filtros, atrás): se adopta como texto actual.
  if (enUrl !== enviado) {
    setEnviado(enUrl);
    setTexto(enUrl);
  }

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio === enviado.trim()) return;
    const espera = setTimeout(() => {
      setEnviado(limpio);
      navegar({ [parametro]: limpio || null });
    }, retrasoMs);
    return () => clearTimeout(espera);
  }, [texto, enviado, navegar, parametro, retrasoMs]);

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== "/" || evento.ctrlKey || evento.metaKey || evento.altKey || esCampoEditable(evento.target)) return;
      evento.preventDefault();
      campo.current?.focus();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  return (
    <div role="search" className={cn("relative w-full sm:max-w-xs", className)}>
      <label htmlFor={id} className="sr-only">{etiqueta}</label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input ref={campo} id={id} type="search" value={texto} placeholder={marcador} autoComplete="off" maxLength={200}
        onChange={(evento) => setTexto(evento.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-card pr-10 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden" />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
        {pendiente ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
        ) : (
          // Pista de teclado solo con puntero fino (mouse): en táctil no hay tecla "/".
          <kbd aria-hidden="true" className="hidden rounded border border-border bg-muted px-1.5 text-[11px] text-muted-foreground [@media(pointer:fine)]:inline">/</kbd>
        )}
      </span>
    </div>
  );
}
