"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { useEstadoLista } from "./contexto-lista";

export type CambiosUrl = Record<string, string | null | undefined>;

/**
 * Lee y escribe parámetros de la URL.
 * - navegar: pide al servidor la página con los parámetros nuevos (búsqueda y filtros).
 * - superficial: cambia la URL sin petición al servidor (abrir y cerrar drawers).
 */
export function useParametrosUrl() {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [pendientePropio, iniciarPropio] = useTransition();
  const lista = useEstadoLista();
  const iniciar = lista?.iniciar ?? iniciarPropio;

  const construir = useCallback((cambios: CambiosUrl) => {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === undefined || valor === "") nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    const consulta = nuevos.toString();
    return consulta ? `${ruta}?${consulta}` : ruta;
  }, [parametros, ruta]);

  const navegar = useCallback((cambios: CambiosUrl, opciones: { conservarPagina?: boolean } = {}) => {
    const destino = construir(opciones.conservarPagina ? cambios : { pagina: null, ...cambios });
    iniciar(() => router.replace(destino, { scroll: false }));
  }, [construir, iniciar, router]);

  const superficial = useCallback((cambios: CambiosUrl, modo: "agregar" | "reemplazar" = "agregar") => {
    const destino = construir(cambios);
    if (modo === "agregar") window.history.pushState(null, "", destino);
    else window.history.replaceState(null, "", destino);
  }, [construir]);

  return { parametros, construir, navegar, superficial, pendiente: lista?.pendiente ?? pendientePropio };
}
