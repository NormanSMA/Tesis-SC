import type { Metadata } from "next";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { Panel } from "@/modules/panel/componentes/Panel";
import { obtenerPanel } from "@/modules/panel/service";

export const metadata: Metadata = { title: "Panel" };

export default async function PaginaPanel({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string | string[] }>;
}) {
  const actor = await exigirPermisoPagina("panel:ver");
  const { perfil } = await searchParams;
  const solicitado = Array.isArray(perfil) ? perfil[0] : perfil;
  const inicial = await obtenerPanel(actor, new Date(), solicitado);
  return <Panel key={`${inicial.perfil}-${inicial.generadoEn}`} inicial={inicial} />;
}
