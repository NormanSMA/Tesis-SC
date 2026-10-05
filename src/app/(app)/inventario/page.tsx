import type { Metadata } from "next";

import { ModuloEnConstruccion } from "@/components/comunes/ModuloEnConstruccion";

export const metadata: Metadata = { title: "Inventario" };

export default function Pagina() {
  return <ModuloEnConstruccion titulo="Inventario" descripcion="Existencias, movimientos y consumo de materiales." />;
}
