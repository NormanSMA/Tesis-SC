import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Clientes" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Clientes" descripcion="Personas y empresas que solicitan trabajos." />;
}
