"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

import type { UsuarioSesion } from "@/lib/auth/sesion";
import { cn } from "@/lib/utils";

import { BarraLateral } from "./BarraLateral";
import { BarraSuperior } from "./BarraSuperior";
import { MenuMovil } from "./MenuMovil";
import { filtrarNavegacion, gruposNavegacion } from "./navegacion";
import { useCerrarConEscape } from "./useCerrarConEscape";

/** Estado del menú: panel móvil, riel expandido (tableta) y menú compacto (pantalla grande). */
function useEstadoMenu() {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [rielExpandido, setRielExpandido] = useState(false);
  const [compacto, setCompacto] = useState(false);
  const cerrarRiel = useCallback(() => setRielExpandido(false), []);
  const cerrarRielConFoco = useCallback(() => {
    setRielExpandido(false);
    document.getElementById("alternar-riel")?.focus();
  }, []);
  useCerrarConEscape(rielExpandido, cerrarRielConFoco);
  return { menuMovilAbierto, setMenuMovilAbierto, rielExpandido, setRielExpandido, compacto, setCompacto, cerrarRiel, cerrarRielConFoco };
}

export function AppShell({ usuario, children }: { usuario: UsuarioSesion; children: ReactNode }) {
  const ruta = usePathname();
  const grupos = filtrarNavegacion(gruposNavegacion, usuario.permisos);
  const { menuMovilAbierto, setMenuMovilAbierto, rielExpandido, setRielExpandido, compacto, setCompacto, cerrarRiel, cerrarRielConFoco } =
    useEstadoMenu();

  return (
    <div className="min-h-dvh">
      <BarraLateral
        usuario={usuario}
        grupos={grupos}
        ruta={ruta}
        rielExpandido={rielExpandido}
        compacto={compacto}
        alCerrarRiel={cerrarRiel}
        alCerrarRielConFoco={cerrarRielConFoco}
      />
      {rielExpandido ? (
        <div
          aria-hidden="true"
          onClick={cerrarRielConFoco}
          className="fixed inset-0 z-30 hidden bg-foreground/20 md:block xl:hidden"
        />
      ) : null}
      <div className={cn("transition-[padding] duration-200 md:pl-16", !compacto && "xl:pl-64")}>
        <BarraSuperior
          ruta={ruta}
          rielExpandido={rielExpandido}
          compacto={compacto}
          alAbrirMenuMovil={() => setMenuMovilAbierto(true)}
          alAlternarRiel={() => setRielExpandido((valor) => !valor)}
          alAlternarCompacto={() => setCompacto((valor) => !valor)}
        />
        <main id="contenido" tabIndex={-1} className="px-4 py-6 outline-none xl:px-6">
          {children}
        </main>
      </div>
      <MenuMovil
        usuario={usuario}
        abierto={menuMovilAbierto}
        alCambiarAbierto={setMenuMovilAbierto}
        grupos={grupos}
        ruta={ruta}
      />
    </div>
  );
}
