import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Clientes" };

export default async function Pagina() {
  await exigirPermisoPagina("cliente:ver");
  return <ModuloEnConstruccion titulo="Clientes" descripcion="Personas y empresas que solicitan trabajos." />;
}
