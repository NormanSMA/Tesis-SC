import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Cotizaciones" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Cotizaciones" descripcion="Elaboración, envío y respuesta de cotizaciones." />;
}
