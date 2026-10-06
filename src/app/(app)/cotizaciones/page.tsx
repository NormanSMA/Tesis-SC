import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Cotizaciones" };

export default async function Pagina() {
  await exigirPermisoPagina("cotizacion:ver");
  return <ModuloEnConstruccion titulo="Cotizaciones" descripcion="Elaboración, envío y respuesta de cotizaciones." />;
}
