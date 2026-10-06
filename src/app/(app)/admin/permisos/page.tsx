import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Perfiles y permisos" };

export default async function Pagina() {
  await exigirPermisoPagina("permiso:gestionar");
  return <ModuloEnConstruccion titulo="Perfiles y permisos" descripcion="Matriz de permisos por perfil." />;
}
