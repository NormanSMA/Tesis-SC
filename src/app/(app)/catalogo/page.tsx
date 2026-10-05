import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Catálogo" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Catálogo" descripcion="Productos, recetas, categorías y áreas." />;
}
