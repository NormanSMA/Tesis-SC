import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Usuarios" };

export default async function Pagina() {
  await exigirPermisoPagina("usuario:gestionar");
  return <ModuloEnConstruccion titulo="Usuarios" descripcion="Cuentas de acceso y perfil asignado." />;
}
