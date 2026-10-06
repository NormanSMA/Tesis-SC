import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Reportes" };

export default async function Pagina() {
  await exigirPermisoPagina("reporte:ver");
  return <ModuloEnConstruccion titulo="Reportes" descripcion="Indicadores y exportación de información." />;
}
