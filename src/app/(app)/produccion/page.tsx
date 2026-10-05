import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Producción" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Producción" descripcion="Etapas, áreas y responsables de cada orden." />;
}
