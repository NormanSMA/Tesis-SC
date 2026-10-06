import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Inventario" };

export default async function Pagina() {
  await exigirPermisoPagina("inventario:ver");
  return <ModuloEnConstruccion titulo="Inventario" descripcion="Existencias, movimientos y consumo de materiales." />;
}
