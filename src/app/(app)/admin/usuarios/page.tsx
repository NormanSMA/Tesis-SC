import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Usuarios" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Usuarios" descripcion="Cuentas de acceso y perfil asignado." />;
}
