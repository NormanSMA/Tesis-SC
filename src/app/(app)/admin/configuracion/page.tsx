import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Configuración" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Configuración" descripcion="Parámetros generales de la plataforma." />;
}
