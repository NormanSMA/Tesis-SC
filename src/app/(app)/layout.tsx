import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { COOKIE_MENU, VALOR_MENU_COMPACTO } from "@/components/layout/preferencia-menu";
import { obtenerSesion } from "@/lib/auth/sesion";
import { GuardiaCambioClave } from "@/modules/auth/componentes/FormularioCambiarClave";

// La sesión depende de la cookie de cada solicitud: nada de esta zona se prerrenderiza.
export const dynamic = "force-dynamic";

const FECHA_LARGA = new Intl.DateTimeFormat("es-NI", {
  weekday: "long", day: "numeric", month: "long", timeZone: "America/Managua",
});

export default async function LayoutAplicacion({ children }: { children: ReactNode }) {
  const usuario = await obtenerSesion();
  if (!usuario) redirect("/login");
  if (usuario.debeCambiarClave) return <GuardiaCambioClave>{children}</GuardiaCambioClave>;
  const compactoInicial = (await cookies()).get(COOKIE_MENU)?.value === VALOR_MENU_COMPACTO;
  // La fecha se calcula en el servidor (hora de Managua): el cliente hidrata el mismo texto.
  const fechaHoy = FECHA_LARGA.format(new Date());
  return <AppShell usuario={usuario} compactoInicial={compactoInicial} fechaHoy={fechaHoy}>{children}</AppShell>;
}
