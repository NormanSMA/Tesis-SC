"use client";

import { useEffect, useState } from "react";
import type { ContadoresMenu } from "@/modules/navegacion/contadores";

/** `activo` es false si el perfil no puede consultar el endpoint (requiere panel:ver): no se pide y no hay 403. */
export function useContadoresMenu(ruta: string, activo = true): ContadoresMenu {
  const [contadores, establecerContadores] = useState<ContadoresMenu>({});
  useEffect(() => {
    if (!activo) return;
    let controlador: AbortController | undefined;
    async function actualizar() {
      controlador?.abort();
      const actual = new AbortController();
      controlador = actual;
      try {
        const respuesta = await fetch("/api/v1/contadores", { signal: actual.signal, cache: "no-store" });
        if (!respuesta.ok) throw new Error("No se pudieron consultar los contadores.");
        const cuerpo: { datos: ContadoresMenu } = await respuesta.json();
        if (!actual.signal.aborted) establecerContadores(cuerpo.datos);
      } catch {
        if (!actual.signal.aborted) establecerContadores({});
      }
    }
    void actualizar();
    const intervalo = window.setInterval(() => void actualizar(), 60_000);
    return () => { controlador?.abort(); window.clearInterval(intervalo); };
  }, [ruta, activo]);
  return contadores;
}
