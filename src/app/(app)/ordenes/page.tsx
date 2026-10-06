import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

export default async function Pagina() {
  await exigirPermisoPagina("orden:ver");
  return <ModuloEnConstruccion titulo="Órdenes de trabajo" descripcion="Órdenes generadas desde cotizaciones aprobadas." />;
}
