import type { Metadata } from "next";
import { can } from "@/core/autorizacion";
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
  return <Panel key={inicial.perfil} inicial={inicial} puedeCrearCotizacion={can(actor, "cotizacion:gestionar")} />;
}
