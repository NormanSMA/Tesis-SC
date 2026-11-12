import Link from "next/link";
import type { ReactNode } from "react";
import { can } from "@/core/autorizacion";
import { obtenerSesion } from "@/lib/auth/sesion";
import { puedeGestionarTarifas } from "@/modules/admin/tarifas-configuracion";

export default async function MenuConfiguracion({ children }: { children: ReactNode }) {
  const actor = await obtenerSesion();
  if (!actor) return children;
  return <>
    <nav aria-label="Submenú de Configuración" className="mb-4 flex gap-2 border-b pb-2">
      {can(actor, "configuracion:gestionar") ? <Link className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
        href="/admin/configuracion">General</Link> : null}
      {puedeGestionarTarifas(actor) ? <Link className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
        href="/admin/configuracion/tarifas">Tarifas</Link> : null}
    </nav>
    {children}
  </>;
}
