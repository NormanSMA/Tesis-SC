"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";

type EstadoLista = { pendiente: boolean; iniciar: TransitionStartFunction };

const ContextoLista = createContext<EstadoLista | null>(null);

/**
 * Comparte una sola transición entre la barra de búsqueda, los filtros y la zona de resultados.
 * React descarta las transiciones obsoletas: al teclear rápido gana la última URL.
 */
export function ProveedorLista({ children }: { children: ReactNode }) {
  const [pendiente, iniciar] = useTransition();
  return <ContextoLista.Provider value={{ pendiente, iniciar }}>{children}</ContextoLista.Provider>;
}

export function useEstadoLista(): EstadoLista | null {
  return useContext(ContextoLista);
}
