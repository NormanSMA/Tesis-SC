"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";

type Tema = "claro" | "oscuro";

function observarTema(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
  return () => observador.disconnect();
}

function useTema(): Tema {
  return useSyncExternalStore(observarTema, () => document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro", () => "claro");
}

function cambiarTema(tema: Tema) {
  document.documentElement.dataset.tema = tema;
  try { localStorage.setItem("tracore-tema", tema); } catch { /* La selección sigue vigente en esta página. */ }
}

export function OpcionesTema() {
  const tema = useTema();
  return <>
    <DropdownMenuLabel>Tema</DropdownMenuLabel>
    <DropdownMenuRadioGroup aria-label="Tema" value={tema}>
      <DropdownMenuRadioItem className="min-h-11" value="claro" onSelect={() => cambiarTema("claro")}>
        <Sun aria-hidden="true" /> Modo claro
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem className="min-h-11" value="oscuro" onSelect={() => cambiarTema("oscuro")}>
        <Moon aria-hidden="true" /> Modo oscuro
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </>;
}

export function AlternarTema() {
  const oscuro = useTema() === "oscuro";
  const Icono = oscuro ? Sun : Moon;
  return <Button type="button" variant="outline" size="icon" aria-label={oscuro ? "Activar modo claro" : "Activar modo oscuro"}
    title={oscuro ? "Activar modo claro" : "Activar modo oscuro"} onClick={() => cambiarTema(oscuro ? "claro" : "oscuro")}>
    <Icono aria-hidden="true" />
  </Button>;
}
