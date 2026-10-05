import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { obtenerSesion } from "@/lib/auth/sesion";

// La sesión depende de la cookie de cada solicitud: nada de esta zona se prerrenderiza.
export const dynamic = "force-dynamic";

export default async function LayoutAplicacion({ children }: { children: ReactNode }) {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
