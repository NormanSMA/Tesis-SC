"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

function observarTema(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  return () => observador.disconnect();
}

export function AlternarTema() {
  const oscuro = useSyncExternalStore(observarTema, () => document.documentElement.dataset.tema === "oscuro", () => false);
  function alternar() {
    const tema = oscuro ? "claro" : "oscuro";
    document.documentElement.dataset.tema = tema;
    try { localStorage.setItem("tracore-tema", tema); } catch { /* La selección sigue vigente en esta página. */ }
  }
  const Icono = oscuro ? Sun : Moon;
  return <Button type="button" variant="outline" size="icon" aria-label={oscuro ? "Activar modo claro" : "Activar modo oscuro"}
    title={oscuro ? "Activar modo claro" : "Activar modo oscuro"} onClick={alternar}>
    <Icono aria-hidden="true" />
  </Button>;
}
