import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Órdenes de trabajo" descripcion="Órdenes generadas desde cotizaciones aprobadas." />;
}
