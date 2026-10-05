import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Trazabilidad" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Trazabilidad" descripcion="Historial de cambios de cotizaciones, órdenes e inventario." />;
}
