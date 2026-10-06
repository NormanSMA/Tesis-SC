import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Catálogo" };

export default async function Pagina() {
  await exigirPermisoPagina("catalogo:ver");
  return <ModuloEnConstruccion titulo="Catálogo" descripcion="Productos, recetas, categorías y áreas." />;
}
