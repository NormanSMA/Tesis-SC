import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { BotonImprimir } from "@/components/comunes/BotonImprimir";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { OrdenImprimible } from "@/modules/ordenes/componentes/OrdenImprimible";
import { cargarOrden } from "@/modules/ordenes/paginas";
import "./impresion.css";

export const metadata: Metadata = { title: "Orden de trabajo imprimible" };

export default async function PaginaImprimirOrden({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("orden:ver");
  const orden = await cargarOrden((await params).id, actor);
  return <>
    <div className="controles-orden-impresa"><CabeceraFicha titulo="Orden de trabajo imprimible"
      marca={<MarcaIcono><ClipboardList /></MarcaIcono>}
      volver={{ href: `/ordenes/${orden.id}`, etiqueta: "Volver a la orden" }}
      acciones={<BotonImprimir />} /></div>
    <OrdenImprimible orden={orden} />
  </>;
}
