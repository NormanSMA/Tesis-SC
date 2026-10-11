import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { obtenerSesion } from "@/lib/auth/sesion";
import { GuardiaCambioClave } from "@/modules/auth/componentes/FormularioCambiarClave";

// La sesión depende de la cookie de cada solicitud: nada de esta zona se prerrenderiza.
export const dynamic = "force-dynamic";

export default async function LayoutAplicacion({ children }: { children: ReactNode }) {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  if (usuario.debeCambiarClave) return <GuardiaCambioClave>{children}</GuardiaCambioClave>;
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
