import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Reportes" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Reportes" descripcion="Indicadores y exportación de información." />;
}
