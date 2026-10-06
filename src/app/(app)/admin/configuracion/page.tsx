import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Configuración" };

export default async function Pagina() {
  await exigirPermisoPagina("configuracion:gestionar");
  return <ModuloEnConstruccion titulo="Configuración" descripcion="Parámetros generales de la plataforma." />;
}
