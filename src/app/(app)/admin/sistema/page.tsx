import type { Metadata } from "next";

import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { PanelSistema } from "@/modules/sistema/componentes/PanelSistema";
import { obtenerEstadoSistema } from "@/modules/sistema/service";

export const metadata: Metadata = { title: "Estado del sistema" };
export const dynamic = "force-dynamic";

export default async function Pagina() {
  const actor = await exigirPermisoPagina("configuracion:gestionar");
  return <PanelSistema datos={await obtenerEstadoSistema(actor)} />;
}
