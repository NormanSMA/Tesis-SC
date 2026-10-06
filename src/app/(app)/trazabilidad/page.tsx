import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Trazabilidad" };

export default async function Pagina() {
  await exigirPermisoPagina("bitacora:ver");
  return <ModuloEnConstruccion titulo="Trazabilidad" descripcion="Historial de cambios de cotizaciones, órdenes e inventario." />;
}
