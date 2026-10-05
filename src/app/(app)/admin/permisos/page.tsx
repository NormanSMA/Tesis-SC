import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Perfiles y permisos" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Perfiles y permisos" descripcion="Matriz de permisos por perfil." />;
}
