import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Producción" };

export default async function Pagina() {
  await exigirPermisoPagina("produccion:ver");
  return <ModuloEnConstruccion titulo="Producción" descripcion="Etapas, áreas y responsables de cada orden." />;
}
