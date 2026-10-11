"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

import type { UsuarioSesion } from "@/lib/auth/sesion";

import { BarraLateral } from "./BarraLateral";
import { BarraSuperior } from "./BarraSuperior";
import { MenuMovil } from "./MenuMovil";
import { filtrarNavegacion, gruposNavegacion } from "./navegacion";
import { useCerrarConEscape } from "./useCerrarConEscape";

export function AppShell({ usuario, children }: { usuario: UsuarioSesion; children: ReactNode }) {
  const ruta = usePathname();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [rielExpandido, setRielExpandido] = useState(false);
  const grupos = filtrarNavegacion(gruposNavegacion, usuario.permisos);
  const cerrarRiel = useCallback(() => setRielExpandido(false), []);
  const cerrarRielConFoco = useCallback(() => {
    setRielExpandido(false);
    document.getElementById("alternar-riel")?.focus();
  }, []);
  useCerrarConEscape(rielExpandido, cerrarRielConFoco);

  return (
    <div className="min-h-dvh">
      <BarraLateral
        grupos={grupos}
        ruta={ruta}
        rielExpandido={rielExpandido}
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
      <div className="md:pl-16 xl:pl-64">
        <BarraSuperior
          usuario={usuario}
          ruta={ruta}
          rielExpandido={rielExpandido}
          alAbrirMenuMovil={() => setMenuMovilAbierto(true)}
          alAlternarRiel={() => setRielExpandido((valor) => !valor)}
        />
        <main id="contenido" tabIndex={-1} className="px-4 py-6 outline-none xl:px-6">
          {children}
        </main>
      </div>
      <MenuMovil
        abierto={menuMovilAbierto}
        alCambiarAbierto={setMenuMovilAbierto}
        grupos={grupos}
        ruta={ruta}
      />
    </div>
  );
}
