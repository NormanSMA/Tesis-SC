import type { Metadata } from "next";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { Panel } from "@/modules/panel/componentes/Panel";
import { obtenerPanel } from "@/modules/panel/service";

export const metadata: Metadata = { title: "Panel" };
export default async function PaginaPanel() {
  const actor = await exigirPermisoPagina("panel:ver");
  return <Panel inicial={await obtenerPanel(actor)} />;
}
